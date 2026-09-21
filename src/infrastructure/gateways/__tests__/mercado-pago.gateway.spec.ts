import { PaymentGatewayException } from '@application/exceptions/payment-gateway.exception';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentMethod, PaymentStatus } from '@domain/enums';

import { MercadoPagoGateway } from '../mercado-pago.gateway';

const VALID_CPF = '52998224725';
const PAYMENT_ID = 'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b';

const buildPayment = (): Payment =>
  Payment.create(
    PAYMENT_ID,
    VALID_CPF,
    'Mensalidade',
    149.9,
    PaymentMethod.CREDIT_CARD,
  );

const buildConfig = (overrides: Record<string, unknown> = {}) => ({
  accessToken: 'TEST-access-token',
  notificationUrl: 'https://app.local/api/payment/webhook',
  webhookSecret: '',
  backUrl: '',
  timeoutMs: 10_000,
  ...overrides,
});

describe('MercadoPagoGateway', () => {
  let gateway: MercadoPagoGateway;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    gateway = new MercadoPagoGateway(buildConfig());
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('deve criar a preferência e devolver id e init_point', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'pref-123',
        init_point: 'https://mp.com/checkout/pref-123',
      }),
    } as Response);

    const result = await gateway.createCheckoutPreference(buildPayment());

    expect(result).toEqual({
      externalId: 'pref-123',
      initPoint: 'https://mp.com/checkout/pref-123',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/checkout/preferences');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer TEST-access-token');
    expect(init.headers['X-Idempotency-Key']).toBe(PAYMENT_ID);
    expect(JSON.parse(init.body).external_reference).toBe(PAYMENT_ID);
  });

  it('deve preferir o init_point ao sandbox_init_point', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'pref-9',
        init_point: 'https://mp.com/prod',
        sandbox_init_point: 'https://mp.com/sandbox',
      }),
    } as Response);

    const result = await gateway.createCheckoutPreference(buildPayment());

    expect(result.initPoint).toBe('https://mp.com/prod');
  });

  it('deve cair no sandbox_init_point quando não há init_point', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'pref-9',
        sandbox_init_point: 'https://mp.com/sandbox',
      }),
    } as Response);

    const result = await gateway.createCheckoutPreference(buildPayment());

    expect(result.initPoint).toBe('https://mp.com/sandbox');
  });

  it('deve recusar uma preferência sem nenhuma URL de checkout', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'pref-sem-url' }),
    } as Response);

    await expect(
      gateway.createCheckoutPreference(buildPayment()),
    ).rejects.toThrow(PaymentGatewayException);
  });

  it('deve enviar notification_url quando configurada', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'pref-1', init_point: 'https://mp.com/x' }),
    } as Response);

    await gateway.createCheckoutPreference(buildPayment());

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.notification_url).toBe('https://app.local/api/payment/webhook');
  });

  it('deve omitir notification_url quando não está configurada', async () => {
    gateway = new MercadoPagoGateway(buildConfig({ notificationUrl: '' }));

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'pref-1', init_point: 'https://mp.com/x' }),
    } as Response);

    await gateway.createCheckoutPreference(buildPayment());

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.notification_url).toBeUndefined();
  });

  it('deve omitir back_urls e auto_return quando backUrl não está configurado', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'pref-1', init_point: 'https://mp.com/x' }),
    } as Response);

    await gateway.createCheckoutPreference(buildPayment());

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.back_urls).toBeUndefined();
    expect(body.auto_return).toBeUndefined();
  });

  it('deve montar as back_urls a partir do backUrl, sem barra duplicada', async () => {
    gateway = new MercadoPagoGateway(
      buildConfig({ backUrl: 'https://tunel.local/' }),
    );

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'pref-1', init_point: 'https://mp.com/x' }),
    } as Response);

    await gateway.createCheckoutPreference(buildPayment());

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.back_urls.success).toBe(
      'https://tunel.local/api/payment/checkout/return?outcome=success',
    );
    expect(body.back_urls.failure).toContain('outcome=failure');
    expect(body.back_urls.pending).toContain('outcome=pending');
    expect(body.auto_return).toBe('approved');
  });

  it('deve traduzir o erro HTTP do provedor', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'invalid token',
    } as Response);

    await expect(
      gateway.createCheckoutPreference(buildPayment()),
    ).rejects.toThrow(PaymentGatewayException);
  });

  it.each([
    ['approved', PaymentStatus.PAID],
    ['rejected', PaymentStatus.FAIL],
    ['cancelled', PaymentStatus.FAIL],
    ['pending', null],
    ['in_process', null],
  ])('deve mapear o status %s do provedor', async (mpStatus, expected) => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 987,
        status: mpStatus,
        external_reference: PAYMENT_ID,
      }),
    } as Response);

    const result = await gateway.fetchPayment('987');

    expect(result.status).toBe(expected);
    expect(result.externalReference).toBe(PAYMENT_ID);
    expect(result.providerPaymentId).toBe('987');
  });

  it('deve expor o status do provedor no erro, para decidir o retry', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'unavailable',
    } as Response);

    const error = await gateway
      .createCheckoutPreference(buildPayment())
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PaymentGatewayException);
    expect((error as PaymentGatewayException).providerStatus).toBe(503);
    expect((error as PaymentGatewayException).retryable).toBe(true);
  });

  it.each([
    ['timeout', new DOMException('The operation timed out', 'TimeoutError')],
    ['falha de rede', new TypeError('fetch failed')],
  ])(
    'deve traduzir %s num erro de gateway retentável',
    async (_case, cause) => {
      fetchMock.mockRejectedValue(cause);

      const error = await gateway.fetchPayment('987').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(PaymentGatewayException);
      expect((error as PaymentGatewayException).providerStatus).toBeNull();
      expect((error as PaymentGatewayException).retryable).toBe(true);
    },
  );

  describe('findPaymentByExternalReference', () => {
    const searchReturns = (results: unknown[]) =>
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ results }),
      } as Response);

    it('deve buscar pelo external_reference, do mais recente para o mais antigo', async () => {
      searchReturns([]);

      await gateway.findPaymentByExternalReference(PAYMENT_ID);

      const url = new URL(fetchMock.mock.calls[0][0]);
      expect(url.pathname).toBe('/v1/payments/search');
      expect(url.searchParams.get('external_reference')).toBe(PAYMENT_ID);
      expect(url.searchParams.get('sort')).toBe('date_created');
      expect(url.searchParams.get('criteria')).toBe('desc');
    });

    it('deve devolver null quando o cliente ainda não pagou', async () => {
      searchReturns([]);

      await expect(
        gateway.findPaymentByExternalReference(PAYMENT_ID),
      ).resolves.toBeNull();
    });

    it('deve usar a tentativa mais recente quando não há aprovação', async () => {
      searchReturns([
        { id: 2, status: 'rejected', external_reference: PAYMENT_ID },
        { id: 1, status: 'in_process', external_reference: PAYMENT_ID },
      ]);

      const result = await gateway.findPaymentByExternalReference(PAYMENT_ID);

      expect(result).toEqual({
        providerPaymentId: '2',
        externalReference: PAYMENT_ID,
        status: PaymentStatus.FAIL,
      });
    });

    it('deve preferir a aprovação a uma recusa mais recente', async () => {
      searchReturns([
        { id: 3, status: 'rejected', external_reference: PAYMENT_ID },
        { id: 2, status: 'approved', external_reference: PAYMENT_ID },
      ]);

      const result = await gateway.findPaymentByExternalReference(PAYMENT_ID);

      expect(result?.providerPaymentId).toBe('2');
      expect(result?.status).toBe(PaymentStatus.PAID);
    });
  });
});
