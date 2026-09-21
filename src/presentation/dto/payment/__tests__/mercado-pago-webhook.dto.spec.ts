import { MercadoPagoWebhookDto } from '../mercado-pago-webhook.dto';

describe('MercadoPagoWebhookDto.resolvePaymentId', () => {
  it('deve ler o formato Webhooks (type + data.id)', () => {
    expect(
      MercadoPagoWebhookDto.resolvePaymentId({
        type: 'payment',
        data: { id: 1234567890 },
      }),
    ).toBe('1234567890');
  });

  it('deve ler o formato IPN (topic + resource como URL)', () => {
    expect(
      MercadoPagoWebhookDto.resolvePaymentId({
        topic: 'payment',
        resource: 'https://api.mercadopago.com/v1/payments/987',
      }),
    ).toBe('987');
  });

  it('deve aceitar o id vindo pela query string', () => {
    expect(
      MercadoPagoWebhookDto.resolvePaymentId({ type: 'payment' }, '555'),
    ).toBe('555');
  });

  it('deve ignorar eventos que não são de pagamento', () => {
    expect(
      MercadoPagoWebhookDto.resolvePaymentId({
        type: 'merchant_order',
        data: { id: 42 },
      }),
    ).toBeNull();
  });

  it('deve devolver null quando não há id', () => {
    expect(MercadoPagoWebhookDto.resolvePaymentId({})).toBeNull();
  });
});
