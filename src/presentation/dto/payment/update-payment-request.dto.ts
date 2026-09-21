import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { MAX_DESCRIPTION_LENGTH } from '@domain/constants';
import { PaymentStatus } from '@domain/enums';

export class UpdatePaymentRequestDto {
  @ApiPropertyOptional({
    example: 'Mensalidade de outubro (revisada)',
    description: 'Nova descrição da cobrança',
    maxLength: MAX_DESCRIPTION_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description?: string;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    example: PaymentStatus.PAID,
    description: 'Novo status do pagamento',
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
}
