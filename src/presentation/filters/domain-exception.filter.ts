import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import {
  ConflictDomainException,
  DomainException,
  InvalidInputException,
  NotFoundDomainException,
} from '@domain/exceptions';

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter<DomainException> {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  private static statusFor(exception: DomainException): HttpStatus {
    if (exception instanceof NotFoundDomainException) {
      return HttpStatus.NOT_FOUND;
    }

    if (exception instanceof ConflictDomainException) {
      return HttpStatus.CONFLICT;
    }

    if (exception instanceof InvalidInputException) {
      return HttpStatus.BAD_REQUEST;
    }

    return HttpStatus.UNPROCESSABLE_ENTITY;
  }

  catch(exception: DomainException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    const statusCode = DomainExceptionFilter.statusFor(exception);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception.message, exception.stack);
    }

    void response.status(statusCode).send({
      statusCode,
      error: exception.name,
      message: exception.message,
    });
  }
}
