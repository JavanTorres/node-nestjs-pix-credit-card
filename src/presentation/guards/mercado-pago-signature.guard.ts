import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';

import { mercadoPagoConfig } from '@config/configuration';

@Injectable()
export class MercadoPagoSignatureGuard implements CanActivate {
  private readonly logger = new Logger(MercadoPagoSignatureGuard.name);

  private warned = false;

  constructor(
    @Inject(mercadoPagoConfig.KEY)
    private readonly config: ConfigType<typeof mercadoPagoConfig>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const { webhookSecret } = this.config;

    if (!webhookSecret) {
      if (!this.warned) {
        this.logger.warn(
          'MERCADO_PAGO_WEBHOOK_SECRET ausente — o webhook está aceitando ' +
            'qualquer requisição. Configure o segredo do painel de Webhooks.',
        );
        this.warned = true;
      }
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    const signature = MercadoPagoSignatureGuard.header(request, 'x-signature');
    const requestId = MercadoPagoSignatureGuard.header(request, 'x-request-id');
    const dataId = MercadoPagoSignatureGuard.dataId(request);

    if (!signature) {
      throw new UnauthorizedException('Notificação sem x-signature.');
    }

    const { ts, v1 } = MercadoPagoSignatureGuard.parseSignature(signature);

    if (!ts || !v1) {
      throw new UnauthorizedException('x-signature em formato inesperado.');
    }

    const manifest = [
      dataId ? `id:${dataId.toLowerCase()};` : '',
      requestId ? `request-id:${requestId};` : '',
      `ts:${ts};`,
    ].join('');

    const expected = createHmac('sha256', webhookSecret)
      .update(manifest)
      .digest('hex');

    if (!MercadoPagoSignatureGuard.matches(expected, v1)) {
      this.logger.warn(
        `Assinatura inválida na notificação ${dataId ?? '(sem id)'}. Rejeitada.`,
      );
      throw new UnauthorizedException('Assinatura inválida.');
    }

    return true;
  }

  private static header(
    request: FastifyRequest,
    name: string,
  ): string | undefined {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }

  private static dataId(request: FastifyRequest): string | undefined {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const value = query['data.id'] ?? query['id'];
    return typeof value === 'string' ? value : undefined;
  }

  private static parseSignature(signature: string): {
    ts?: string;
    v1?: string;
  } {
    const parts: Record<string, string> = {};

    for (const piece of signature.split(',')) {
      const separator = piece.indexOf('=');
      if (separator === -1) continue;

      const key = piece.slice(0, separator).trim();
      parts[key] = piece.slice(separator + 1).trim();
    }

    return { ts: parts.ts, v1: parts.v1 };
  }

  private static matches(expected: string, received: string): boolean {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(received, 'utf8');

    return a.length === b.length && timingSafeEqual(a, b);
  }
}
