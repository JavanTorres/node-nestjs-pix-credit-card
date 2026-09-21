import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { PaymentGatewayException } from '@application/exceptions/payment-gateway.exception';

@Catch(PaymentGatewayException)
export class PaymentGatewayExceptionFilter implements ExceptionFilter<PaymentGatewayException> {
  private readonly logger = new Logger(PaymentGatewayExceptionFilter.name);

  catch(exception: PaymentGatewayException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    const statusCode = HttpStatus.BAD_GATEWAY;

    this.logger.error(exception.message, exception.stack);

    void response.status(statusCode).send({
      statusCode,
      error: exception.name,
      message: exception.message,
    });
  }
}
