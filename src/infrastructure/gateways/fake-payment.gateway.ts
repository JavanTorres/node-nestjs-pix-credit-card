import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { PaymentGatewayException } from '@application/exceptions/payment-gateway.exception';
import {
  CheckoutPreference,
  GatewayPayment,
  PaymentGatewayPort,
} from '@application/ports/payment-gateway.port';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentStatus } from '@domain/enums';

@Injectable()
export class FakePaymentGateway implements PaymentGatewayPort {
  private readonly logger = new Logger(FakePaymentGateway.name);

  private readonly payments = new Map<string, GatewayPayment>();

  async createCheckoutPreference(
    payment: Payment,
  ): Promise<CheckoutPreference> {
    const preferenceId = `fake-pref-${uuidv4()}`;
    const providerPaymentId = `fake-pay-${uuidv4()}`;

    this.payments.set(providerPaymentId, {
      providerPaymentId,
      externalReference: payment.id,
      status: PaymentStatus.PAID,
    });

    this.logger.warn(
      `MERCADO_PAGO_ACCESS_TOKEN ausente — usando gateway simulado. ` +
        `Dispare o webhook com providerPaymentId=${providerPaymentId} ` +
        `para concluir o pagamento ${payment.id}.`,
    );

    return {
      externalId: preferenceId,
      initPoint: `https://fake-checkout.local/${preferenceId}`,
    };
  }

  async fetchPayment(providerPaymentId: string): Promise<GatewayPayment> {
    const payment = this.payments.get(providerPaymentId);

    if (!payment) {
      throw new PaymentGatewayException(
        `Pagamento ${providerPaymentId} não encontrado no gateway simulado.`,
        404,
      );
    }

    return payment;
  }

  async findPaymentByExternalReference(): Promise<GatewayPayment | null> {
    return null;
  }
}
