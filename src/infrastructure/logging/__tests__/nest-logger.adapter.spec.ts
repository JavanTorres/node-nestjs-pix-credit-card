import { Logger } from '@nestjs/common';

import { NestLoggerAdapter } from '../nest-logger.adapter';

describe('NestLoggerAdapter', () => {
  it('deve repassar cada nível ao Logger do Nest', () => {
    const adapter = new NestLoggerAdapter('Contexto');

    adapter.log('info');
    adapter.warn('aviso');

    expect(Logger.prototype.log).toHaveBeenCalledWith('info');
    expect(Logger.prototype.warn).toHaveBeenCalledWith('aviso');
  });
});
