import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { PaymentGatewayException } from '@application/exceptions/payment-gateway.exception';
import {
  CheckoutPreference,
  GatewayPayment,
  PaymentGatewayPort,
} from '@application/ports/payment-gateway.port';
import { mercadoPagoConfig } from '@config/configuration';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentStatus } from '@domain/enums';

const MERCADO_PAGO_API = 'https://api.mercadopago.com';

interface PreferenceResponse {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
}

interface MercadoPagoPaymentResponse {
  id: number | string;
  status: string;
  external_reference: string;
}

interface MercadoPagoSearchResponse {
  results: MercadoPagoPaymentResponse[];
}

@Injectable()
export class MercadoPagoGateway implements PaymentGatewayPort {
  private readonly logger = new Logger(MercadoPagoGateway.name);

  constructor(
    @Inject(mercadoPagoConfig.KEY)
    private readonly config: ConfigType<typeof mercadoPagoConfig>,
  ) {}

  private async request<T>(
    path: string,
    init: RequestInit & { idempotencyKey?: string } = {},
  ): Promise<T> {
    const { idempotencyKey, ...requestInit } = init;

    const response = await fetch(`${MERCADO_PAGO_API}${path}`, {
      ...requestInit,
      signal: AbortSignal.timeout(this.config.timeoutMs),
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
        ...requestInit.headers,
      },
    }).catch((error: Error) => {
      this.logger.error(
        `Sem resposta do Mercado Pago em ${path}: ${error.message}`,
      );
      throw new PaymentGatewayException(
        `Sem resposta do Mercado Pago em ${path} (${error.name}).`,
      );
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `Mercado Pago respondeu ${response.status} em ${path}: ${body}`,
      );
      throw new PaymentGatewayException(
        `Falha na integração com o Mercado Pago (HTTP ${response.status} em ${path}).`,
        response.status,
      );
    }

    return (await response.json()) as T;
  }

  private returnUrls(): Record<string, unknown> {
    const raw = this.config.backUrl;
    const base = raw.endsWith('/') ? raw.slice(0, -1) : raw;

    if (!base) return {};

    return {
      back_urls: {
        success: `${base}/api/payment/checkout/return?outcome=success`,
        failure: `${base}/api/payment/checkout/return?outcome=failure`,
        pending: `${base}/api/payment/checkout/return?outcome=pending`,
      },
      auto_return: 'approved',
    };
  }

  async createCheckoutPreference(
    payment: Payment,
  ): Promise<CheckoutPreference> {
    const { notificationUrl } = this.config;

    const body = {
      items: [
        {
          id: payment.id,
          title: payment.description,
          quantity: 1,
          unit_price: payment.amount,
          currency_id: 'BRL',
        },
      ],
      payer: {
        identification: { type: 'CPF', number: payment.cpf },
      },
      external_reference: payment.id,
      ...(notificationUrl ? { notification_url: notificationUrl } : {}),
      ...this.returnUrls(),
    };

    const preference = await this.request<PreferenceResponse>(
      '/checkout/preferences',
      {
        method: 'POST',
        body: JSON.stringify(body),
        idempotencyKey: payment.id,
      },
    );

    this.logger.log(
      `Preferência ${preference.id} criada para o pagamento ${payment.id}.`,
    );

    const initPoint = preference.init_point ?? preference.sandbox_init_point;

    if (!initPoint) {
      throw new PaymentGatewayException(
        'O Mercado Pago devolveu uma preferência sem URL de checkout.',
      );
    }

    return { externalId: preference.id, initPoint };
  }

  async fetchPayment(providerPaymentId: string): Promise<GatewayPayment> {
    const payment = await this.request<MercadoPagoPaymentResponse>(
      `/v1/payments/${providerPaymentId}`,
    );

    return MercadoPagoGateway.toGatewayPayment(payment);
  }

  async findPaymentByExternalReference(
    externalReference: string,
  ): Promise<GatewayPayment | null> {
    const query = new URLSearchParams({
      external_reference: externalReference,
      sort: 'date_created',
      criteria: 'desc',
    });

    const { results } = await this.request<MercadoPagoSearchResponse>(
      `/v1/payments/search?${query.toString()}`,
    );

    if (!results?.length) return null;

    const chosen =
      results.find((payment) => payment.status === 'approved') ?? results[0];

    return MercadoPagoGateway.toGatewayPayment(chosen);
  }

  private static toGatewayPayment(
    payment: MercadoPagoPaymentResponse,
  ): GatewayPayment {
    return {
      providerPaymentId: String(payment.id),
      externalReference: payment.external_reference,
      status: MercadoPagoGateway.mapStatus(payment.status),
    };
  }

  private static mapStatus(status: string): PaymentStatus | null {
    switch (status) {
      case 'approved':
        return PaymentStatus.PAID;

      case 'rejected':
      case 'cancelled':
        return PaymentStatus.FAIL;

      default:
        return null;
    }
  }
}
