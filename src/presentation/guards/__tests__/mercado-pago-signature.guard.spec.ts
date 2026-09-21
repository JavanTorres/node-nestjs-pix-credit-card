import { createHmac } from 'node:crypto';

import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { MercadoPagoSignatureGuard } from '../mercado-pago-signature.guard';

const SECRET = 'segredo-do-painel';
const REQUEST_ID = 'bb56a2f1-6aae-46ac-982e-9dcd3581d08e';
const DATA_ID = '1234567890';
const TS = '1704908010';

const buildConfig = (webhookSecret: string) => ({
  accessToken: 'TEST-token',
  notificationUrl: 'https://app.local/api/payment/webhook',
  webhookSecret,
  backUrl: '',
  timeoutMs: 10_000,
});

const sign = (
  secret: string,
  { id = DATA_ID, requestId = REQUEST_ID, ts = TS } = {},
): string =>
  createHmac('sha256', secret)
    .update(`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`)
    .digest('hex');

const buildContext = (
  headers: Record<string, string | undefined>,
  query: Record<string, string> = { 'data.id': DATA_ID },
): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers, query }) }),
  }) as unknown as ExecutionContext;

describe('MercadoPagoSignatureGuard', () => {
  it('deve aceitar uma assinatura válida', () => {
    const guard = new MercadoPagoSignatureGuard(buildConfig(SECRET));

    const context = buildContext({
      'x-signature': `ts=${TS},v1=${sign(SECRET)}`,
      'x-request-id': REQUEST_ID,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('deve recusar assinatura calculada com outro segredo', () => {
    const guard = new MercadoPagoSignatureGuard(buildConfig(SECRET));

    const context = buildContext({
      'x-signature': `ts=${TS},v1=${sign('segredo-errado')}`,
      'x-request-id': REQUEST_ID,
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('deve recusar quando o x-signature não vem', () => {
    const guard = new MercadoPagoSignatureGuard(buildConfig(SECRET));

    expect(() =>
      guard.canActivate(buildContext({ 'x-request-id': REQUEST_ID })),
    ).toThrow(UnauthorizedException);
  });

  it('deve recusar x-signature sem ts ou v1', () => {
    const guard = new MercadoPagoSignatureGuard(buildConfig(SECRET));

    expect(() =>
      guard.canActivate(
        buildContext({
          'x-signature': 'lixo',
          'x-request-id': REQUEST_ID,
        }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('deve recusar quando o ts é adulterado, já que ele entra no manifesto', () => {
    const guard = new MercadoPagoSignatureGuard(buildConfig(SECRET));

    const context = buildContext({
      'x-signature': `ts=9999999999,v1=${sign(SECRET)}`,
      'x-request-id': REQUEST_ID,
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('deve normalizar o data.id para minúsculas antes de conferir', () => {
    const guard = new MercadoPagoSignatureGuard(buildConfig(SECRET));

    const id = 'ABC-DEF';
    const context = buildContext(
      {
        'x-signature': `ts=${TS},v1=${sign(SECRET, { id })}`,
        'x-request-id': REQUEST_ID,
      },
      { 'data.id': id },
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('deve omitir do manifesto as partes ausentes', () => {
    const guard = new MercadoPagoSignatureGuard(buildConfig(SECRET));

    const v1 = createHmac('sha256', SECRET).update(`ts:${TS};`).digest('hex');

    const context = buildContext({ 'x-signature': `ts=${TS},v1=${v1}` }, {});

    expect(guard.canActivate(context)).toBe(true);
  });

  it('deve liberar a requisição quando não há segredo configurado', () => {
    const guard = new MercadoPagoSignatureGuard(buildConfig(''));

    expect(guard.canActivate(buildContext({}, {}))).toBe(true);
  });
});
