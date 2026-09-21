import { ApplicationFailure } from '@temporalio/common';

import { PaymentGatewayException } from '@application/exceptions/payment-gateway.exception';
import { ProcessPaymentNotificationUseCase } from '@application/usecases/payment/process-payment-notification.usecase';
import { ReconcilePaymentUseCase } from '@application/usecases/payment/reconcile-payment.usecase';
import { StartCheckoutUseCase } from '@application/usecases/payment/start-checkout.usecase';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';
import { PaymentMethod, PaymentStatus } from '@domain/enums';
import { ConcurrentPaymentUpdateException } from '@domain/exceptions';

import {
  createPaymentActivities,
  PaymentActivities,
} from '../activities/payment.activities';

const PAYMENT_ID = 'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b';

const snapshot = {
  id: PAYMENT_ID,
  cpf: '52998224725',
  description: 'Compra',
  amount: 99.9,
  paymentMethod: 'CREDIT_CARD',
  createdAt: '2026-09-21T12:00:00.000Z',
};

const buildPayment = (status = PaymentStatus.PENDING): Payment =>
  Payment.create(
    PAYMENT_ID,
    '52998224725',
    'Compra',
    99.9,
    PaymentMethod.CREDIT_CARD,
    status,
  );

describe('PaymentActivities', () => {
  let activities: PaymentActivities;
  let repo: jest.Mocked<PaymentRepositoryContract>;
  let startCheckout: jest.Mocked<StartCheckoutUseCase>;
  let processNotification: jest.Mocked<ProcessPaymentNotificationUseCase>;
  let reconcile: jest.Mocked<ReconcilePaymentUseCase>;

  beforeEach(() => {
    repo = {
      findById: jest.fn().mockResolvedValue(buildPayment()),
      create: jest.fn(async (payment: Payment) => payment),
      update: jest.fn(async (payment: Payment) => payment),
    } as unknown as jest.Mocked<PaymentRepositoryContract>;

    startCheckout = {
      execute: jest.fn(async (payment: Payment) =>
        payment.withCheckout('pref-1', 'https://mp.com/1'),
      ),
    } as unknown as jest.Mocked<StartCheckoutUseCase>;

    processNotification = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ProcessPaymentNotificationUseCase>;

    reconcile = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ReconcilePaymentUseCase>;

    activities = createPaymentActivities({
      paymentRepository: repo,
      startCheckout,
      processPaymentNotification: processNotification,
      reconcilePayment: reconcile,
    });
  });

  describe('registerPayment', () => {
    it('deve gravar PENDING com a data da request', async () => {
      repo.findById.mockResolvedValue(null);

      await activities.registerPayment(snapshot);

      const created = repo.create.mock.calls[0][0];
      expect(created.id).toBe(PAYMENT_ID);
      expect(created.status).toBe(PaymentStatus.PENDING);
      expect(created.createdAt.toISOString()).toBe(snapshot.createdAt);
    });

    it('deve ser idempotente quando reexecutada', async () => {
      await activities.registerPayment(snapshot);

      expect(repo.create).not.toHaveBeenCalled();
    });

    it('não deve retentar uma violação de regra de negócio', async () => {
      repo.findById.mockResolvedValue(null);

      const error = await activities
        .registerPayment({ ...snapshot, cpf: '11111111111' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApplicationFailure);
      expect((error as ApplicationFailure).nonRetryable).toBe(true);
    });
  });

  describe('startCheckout', () => {
    it('deve devolver o checkout criado', async () => {
      await expect(activities.startCheckout(PAYMENT_ID)).resolves.toEqual({
        externalId: 'pref-1',
        checkoutUrl: 'https://mp.com/1',
      });
    });

    it('não deve retentar um 4xx do provedor', async () => {
      startCheckout.execute.mockRejectedValue(
        new PaymentGatewayException('HTTP 401', 401),
      );

      const error = await activities
        .startCheckout(PAYMENT_ID)
        .catch((e: unknown) => e);

      expect((error as ApplicationFailure).nonRetryable).toBe(true);
    });

    it.each([500, 503, 429])(
      'deve deixar o Temporal retentar um %s do provedor',
      async (status) => {
        const original = new PaymentGatewayException('falha', status);
        startCheckout.execute.mockRejectedValue(original);

        await expect(activities.startCheckout(PAYMENT_ID)).rejects.toBe(
          original,
        );
      },
    );

    it('deve deixar o Temporal retentar uma falha de rede', async () => {
      const original = new TypeError('fetch failed');
      startCheckout.execute.mockRejectedValue(original);

      await expect(activities.startCheckout(PAYMENT_ID)).rejects.toBe(original);
    });

    it('não deve retentar um pagamento que não existe', async () => {
      repo.findById.mockResolvedValue(null);

      const error = await activities
        .startCheckout(PAYMENT_ID)
        .catch((e: unknown) => e);

      expect((error as ApplicationFailure).nonRetryable).toBe(true);
    });
  });

  describe('applyNotification', () => {
    it('deve deixar o Temporal retentar um conflito de concorrência', async () => {
      const original = new ConcurrentPaymentUpdateException(PAYMENT_ID);
      processNotification.execute.mockRejectedValue(original);

      await expect(activities.applyNotification('mp-1')).rejects.toBe(original);
    });

    it.each([PaymentStatus.PAID, PaymentStatus.FAIL])(
      'deve devolver o status final %s',
      async (status) => {
        processNotification.execute.mockResolvedValue(buildPayment(status));

        await expect(activities.applyNotification('mp-1')).resolves.toBe(
          status,
        );
      },
    );

    it('deve devolver null enquanto o pagamento segue pendente', async () => {
      processNotification.execute.mockResolvedValue(buildPayment());

      await expect(activities.applyNotification('mp-1')).resolves.toBeNull();
    });

    it('deve devolver null quando a notificação é ignorada', async () => {
      processNotification.execute.mockResolvedValue(null);

      await expect(activities.applyNotification('mp-1')).resolves.toBeNull();
    });
  });

  describe('reconcilePayment', () => {
    it('deve repassar o status devolvido pela reconciliação', async () => {
      reconcile.execute.mockResolvedValue(PaymentStatus.PAID);

      await expect(activities.reconcilePayment(PAYMENT_ID)).resolves.toBe(
        PaymentStatus.PAID,
      );
    });

    it('deve devolver null enquanto não houver pagamento', async () => {
      reconcile.execute.mockResolvedValue(null);

      await expect(activities.reconcilePayment(PAYMENT_ID)).resolves.toBeNull();
    });
  });

  describe('markPaymentFailed', () => {
    it('deve levar um pagamento PENDING para FAIL', async () => {
      await expect(activities.markPaymentFailed(PAYMENT_ID)).resolves.toBe(
        PaymentStatus.FAIL,
      );

      expect(repo.update.mock.calls[0][0].status).toBe(PaymentStatus.FAIL);
    });

    it('não deve sobrescrever um pagamento que já foi pago', async () => {
      repo.findById.mockResolvedValue(buildPayment(PaymentStatus.PAID));

      await expect(activities.markPaymentFailed(PAYMENT_ID)).resolves.toBe(
        PaymentStatus.PAID,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });
  });
});
