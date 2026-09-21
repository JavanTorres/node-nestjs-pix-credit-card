import { CreditCardPaymentOrchestratorPort } from '@application/ports/credit-card-payment-orchestrator.port';

export class ReceivePaymentNotificationUseCase {
  constructor(
    private readonly creditCardOrchestrator: CreditCardPaymentOrchestratorPort,
  ) {}

  async execute(providerPaymentId: string): Promise<void> {
    await this.creditCardOrchestrator.notify(providerPaymentId);
  }
}
