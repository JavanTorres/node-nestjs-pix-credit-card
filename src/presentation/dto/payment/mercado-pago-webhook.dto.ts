import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class MercadoPagoWebhookDto {
  @ApiPropertyOptional({ example: 'payment' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 'payment.updated' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ example: { id: '1234567890' } })
  @IsOptional()
  @IsObject()
  data?: { id?: string | number };

  @ApiPropertyOptional({ example: 'payment' })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsOptional()
  @IsString()
  resource?: string;

  static resolvePaymentId(
    body: MercadoPagoWebhookDto,
    queryId?: string,
  ): string | null {
    const kind = body.type ?? body.topic;

    if (kind && kind !== 'payment') return null;

    const id = body.data?.id ?? queryId ?? body.resource?.split('/').pop();

    return id ? String(id) : null;
  }
}
