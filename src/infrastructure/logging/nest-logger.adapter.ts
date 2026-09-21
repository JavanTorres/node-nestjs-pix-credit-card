import { Logger } from '@nestjs/common';

import { LoggerPort } from '@application/ports/logger.port';

export class NestLoggerAdapter extends LoggerPort {
  private readonly logger: Logger;

  constructor(context: string) {
    super();
    this.logger = new Logger(context);
  }

  log(message: string): void {
    this.logger.log(message);
  }

  warn(message: string): void {
    this.logger.warn(message);
  }
}
