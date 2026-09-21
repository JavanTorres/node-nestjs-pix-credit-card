import { ApplicationFailure } from '@temporalio/common';

import { PaymentGatewayException } from '@application/exceptions/payment-gateway.exception';
import { ProcessPaymentNotificationUseCase } from '@application/usecases/payment/process-payment-notification.usecase';
import { ReconcilePaymentUseCase } from '@application/usecases/payment/reconcile-payment.usecase';
import { StartCheckoutUseCase } from '@application/usecases/payment/start-checkout.usecase';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';
import { PaymentMethod, PaymentStatus } from '@domain/enums';
import {
  ConcurrentPaymentUpdateException,
  DomainException,
  PaymentNotFoundException,
} from '@domain/exceptions';

import type {
  FinalPaymentStatus,
  PaymentSnapshot,
} from '../workflows/credit-card-payment.definitions';

interface PaymentActivitiesDeps {
  paymentRepository: PaymentRepositoryContract;
  startCheckout: StartCheckoutUseCase;
  processPaymentNotification: ProcessPaymentNotificationUseCase;
  reconcilePayment: ReconcilePaymentUseCase;
}

const toFinal = (
  status: PaymentStatus | undefined,
): FinalPaymentStatus | null =>
  status === PaymentStatus.PAID || status === PaymentStatus.FAIL
    ? status
    : null;

function classify(error: unknown): never {
  const permanent =
    (error instanceof DomainException &&
      !(error instanceof ConcurrentPaymentUpdateException)) ||
    (error instanceof PaymentGatewayException && !error.retryable);

  if (permanent) {
    throw ApplicationFailure.nonRetryable(
      (error as Error).message,
      (error as Error).name,
    );
  }

  throw error;
}

const guarded =
  <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
  async (...args: A): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      classify(error);
    }
  };

export function createPaymentActivities(deps: PaymentActivitiesDeps) {
  const loadPayment = async (paymentId: string): Promise<Payment> => {
    const payment = await deps.paymentRepository.findById(paymentId);
    if (!payment) throw new PaymentNotFoundException(paymentId);
    return payment;
  };

  return {
    registerPayment: guarded(async (snapshot: PaymentSnapshot) => {
      const existing = await deps.paymentRepository.findById(snapshot.id);
      if (existing) return;

      const createdAt = new Date(snapshot.createdAt);
      await deps.paymentRepository.create(
        Payment.create(
          snapshot.id,
          snapshot.cpf,
          snapshot.description,
          snapshot.amount,
          snapshot.paymentMethod as PaymentMethod,
          PaymentStatus.PENDING,
          createdAt,
          createdAt,
        ),
      );
    }),

    startCheckout: guarded(async (paymentId: string) => {
      const linked = await deps.startCheckout.execute(
        await loadPayment(paymentId),
      );

      return {
        externalId: linked.externalId,
        checkoutUrl: linked.checkoutUrl,
      };
    }),

    applyNotification: guarded(async (providerPaymentId: string) => {
      const payment =
        await deps.processPaymentNotification.execute(providerPaymentId);
      return toFinal(payment?.status);
    }),

    reconcilePayment: guarded(async (paymentId: string) =>
      toFinal((await deps.reconcilePayment.execute(paymentId)) ?? undefined),
    ),

    markPaymentFailed: guarded(async (paymentId: string) => {
      const payment = await loadPayment(paymentId);

      if (!payment.canTransitionTo(PaymentStatus.FAIL)) {
        return toFinal(payment.status) ?? PaymentStatus.FAIL;
      }

      await deps.paymentRepository.update(
        payment.transitionTo(PaymentStatus.FAIL),
      );
      return PaymentStatus.FAIL;
    }),
  };
}

export type PaymentActivities = ReturnType<typeof createPaymentActivities>;
