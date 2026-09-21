import { CreditCardPaymentOrchestratorPort } from '@application/ports/credit-card-payment-orchestrator.port';
import { ProcessPaymentNotificationUseCase } from '@application/usecases/payment/process-payment-notification.usecase';
import { StartCheckoutUseCase } from '@application/usecases/payment/start-checkout.usecase';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';

export class SynchronousCreditCardOrchestrator implements CreditCardPaymentOrchestratorPort {
  constructor(
    private readonly paymentRepository: PaymentRepositoryContract,
    private readonly startCheckout: StartCheckoutUseCase,
    private readonly processPaymentNotification: ProcessPaymentNotificationUseCase,
  ) {}

  async start(payment: Payment): Promise<Payment> {
    const created = await this.paymentRepository.create(payment);
    return this.startCheckout.execute(created);
  }

  async notify(providerPaymentId: string): Promise<void> {
    await this.processPaymentNotification.execute(providerPaymentId);
  }
}
