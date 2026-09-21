import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { WithStartWorkflowOperation } from '@temporalio/client';

import { CreditCardPaymentOrchestratorPort } from '@application/ports/credit-card-payment-orchestrator.port';
import { PaymentGatewayPort } from '@application/ports/payment-gateway.port';
import { ApplyGatewayPaymentUseCase } from '@application/usecases/payment/apply-gateway-payment.usecase';
import { temporalConfig } from '@config/configuration';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';

import { TemporalClientService } from './temporal-client.service';
import {
  checkoutSettledUpdate,
  CREDIT_CARD_PAYMENT_WORKFLOW,
  CreditCardPaymentInput,
  paymentNotificationSignal,
  workflowIdFor,
} from './workflows/credit-card-payment.definitions';
import type { creditCardPaymentWorkflow } from './workflows/credit-card-payment.workflow';

const TIMED_OUT = Symbol('timed-out');

@Injectable()
export class TemporalCreditCardOrchestrator implements CreditCardPaymentOrchestratorPort {
  private readonly logger = new Logger(TemporalCreditCardOrchestrator.name);

  constructor(
    @Inject(temporalConfig.KEY)
    private readonly config: ConfigType<typeof temporalConfig>,
    private readonly temporal: TemporalClientService,
    private readonly paymentRepository: PaymentRepositoryContract,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly applyGatewayPayment: ApplyGatewayPaymentUseCase,
  ) {}

  async start(payment: Payment): Promise<Payment> {
    const input: CreditCardPaymentInput = {
      payment: {
        id: payment.id,
        cpf: payment.cpf,
        description: payment.description,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        createdAt: payment.createdAt.toISOString(),
      },
      pollIntervalMs: this.config.pollIntervalSeconds * 1000,
      paymentTimeoutMs: this.config.paymentTimeoutMinutes * 60 * 1000,
    };

    const startWorkflowOperation = new WithStartWorkflowOperation<
      typeof creditCardPaymentWorkflow
    >(CREDIT_CARD_PAYMENT_WORKFLOW, {
      workflowId: workflowIdFor(payment.id),
      taskQueue: this.config.taskQueue,
      args: [input],
      workflowIdConflictPolicy: 'USE_EXISTING',
    });

    const settled = this.temporal.client.workflow.executeUpdateWithStart(
      checkoutSettledUpdate,
      { startWorkflowOperation },
    );

    const outcome = await this.withTimeout(settled, this.config.checkoutWaitMs);

    if (outcome === TIMED_OUT) {
      settled.catch((error: Error) =>
        this.logger.error(
          `Workflow do pagamento ${payment.id} falhou: ${error.message}`,
        ),
      );
      this.logger.warn(
        `Preferência do pagamento ${payment.id} não ficou pronta em ` +
          `${this.config.checkoutWaitMs}ms; o workflow segue em segundo plano.`,
      );
      return payment;
    }

    return (await this.paymentRepository.findById(payment.id)) ?? payment;
  }

  async notify(providerPaymentId: string): Promise<void> {
    const gatewayPayment =
      await this.paymentGateway.fetchPayment(providerPaymentId);

    try {
      await this.temporal.client.workflow
        .getHandle(workflowIdFor(gatewayPayment.externalReference))
        .signal(paymentNotificationSignal, providerPaymentId);

      this.logger.log(
        `Notificação ${providerPaymentId} entregue ao workflow do pagamento ` +
          `${gatewayPayment.externalReference}.`,
      );
      return;
    } catch (error) {
      this.logger.warn(
        `Workflow do pagamento ${gatewayPayment.externalReference} não ` +
          `recebeu a notificação (${(error as Error).message}); ` +
          'processando direto.',
      );
    }

    await this.applyGatewayPayment.execute(gatewayPayment);
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    ms: number,
  ): Promise<T | typeof TIMED_OUT> {
    let timer: NodeJS.Timeout | undefined;

    const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
      timer = setTimeout(() => resolve(TIMED_OUT), ms);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
