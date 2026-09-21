import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  MAX_DESCRIPTION_LENGTH,
  MAX_PAYMENT_AMOUNT,
  MIN_PAYMENT_AMOUNT,
} from '@domain/constants';
import { PaymentMethod } from '@domain/enums';
import { stripCpfMask } from '@domain/validation/cpf';
import { IsCpf } from '@presentation/validators/is-cpf.validator';

export class CreatePaymentRequestDto {
  @ApiProperty({
    example: '529.982.247-25',
    description: 'CPF do cliente, com ou sem máscara',
  })
  @IsNotEmpty()
  @IsString()
  @IsCpf()
  @Transform(({ value }) =>
    typeof value === 'string' ? stripCpfMask(value) : value,
  )
  cpf: string;

  @ApiProperty({
    example: 'Mensalidade de outubro',
    description: 'Descrição da cobrança',
    maxLength: MAX_DESCRIPTION_LENGTH,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description: string;

  @ApiProperty({
    example: 149.9,
    description: 'Valor da transação em reais',
    minimum: MIN_PAYMENT_AMOUNT,
    maximum: MAX_PAYMENT_AMOUNT,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(MIN_PAYMENT_AMOUNT)
  @Max(MAX_PAYMENT_AMOUNT)
  amount: number;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.PIX,
    description: 'Meio de pagamento',
  })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
