import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PaymentMethod, PaymentStatus } from '@domain/enums';

export class PaymentResponseDto {
  @ApiProperty({ example: '3f1a8c9e-2b4d-4f6a-9c1e-7d5b3a2f8e01' })
  id: string;

  @ApiProperty({ example: '52998224725' })
  cpf: string;

  @ApiProperty({ example: 'Mensalidade de outubro' })
  description: string;

  @ApiProperty({ example: 149.9 })
  amount: number;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.PIX })
  paymentMethod: PaymentMethod;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PENDING })
  status: PaymentStatus;

  @ApiPropertyOptional({
    example: '1234567890-abc-def',
    description: 'Id da preferência de checkout do Mercado Pago',
    nullable: true,
  })
  externalId: string | null;

  @ApiPropertyOptional({
    example: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=...',
    description:
      'URL do Checkout Pro onde o cliente conclui o pagamento. Preenchida ' +
      'apenas para CREDIT_CARD.',
    nullable: true,
  })
  checkoutUrl: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
