import { Payment } from '@domain/entities/payment.entity';
import { PaymentStatus } from '@domain/enums';

export interface CheckoutPreference {
  externalId: string;
  initPoint: string;
}

export interface GatewayPayment {
  providerPaymentId: string;
  externalReference: string;
  status: PaymentStatus | null;
}

export abstract class PaymentGatewayPort {
  abstract createCheckoutPreference(
    payment: Payment,
  ): Promise<CheckoutPreference>;

  abstract fetchPayment(providerPaymentId: string): Promise<GatewayPayment>;

  abstract findPaymentByExternalReference(
    externalReference: string,
  ): Promise<GatewayPayment | null>;
}
