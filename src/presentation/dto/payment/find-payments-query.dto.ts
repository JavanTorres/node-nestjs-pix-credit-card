import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { DEFAULT_PAGINATION } from '@application/usecases/payment/find-all-payments.usecase';
import { PaymentMethod, PaymentStatus } from '@domain/enums';
import { stripCpfMask } from '@domain/validation/cpf';
import { IsCpf } from '@presentation/validators/is-cpf.validator';

const MAX_PAGE_SIZE = 100;

export class FindPaymentsQueryDto {
  @ApiPropertyOptional({
    example: '52998224725',
    description: 'Filtra por CPF do cliente',
  })
  @IsOptional()
  @IsString()
  @IsCpf()
  @Transform(({ value }) =>
    typeof value === 'string' ? stripCpfMask(value) : value,
  )
  cpf?: string;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    description: 'Filtra por meio de pagamento',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    description: 'Filtra por status',
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({
    minimum: 1,
    default: DEFAULT_PAGINATION.page,
    description: 'Página, a partir de 1',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGINATION.limit,
    description: 'Itens por página',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;
}
