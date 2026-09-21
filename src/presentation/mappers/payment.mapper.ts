import { Payment } from '@domain/entities/payment.entity';

import { PaymentResponseDto } from '../dto/payment/payment-response.dto';

export class PaymentMapper {
  static toResponse(payment: Payment): PaymentResponseDto {
    return {
      id: payment.id,
      cpf: payment.cpf,
      description: payment.description,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      externalId: payment.externalId,
      checkoutUrl: payment.checkoutUrl,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}
