import { Payment } from '@domain/entities/payment.entity';
import { PaymentMethod, PaymentStatus } from '@domain/enums';
import {
  InvalidCpfException,
  InvalidPaymentAmountException,
  InvalidPaymentDescriptionException,
  InvalidPaymentStatusTransitionException,
} from '@domain/exceptions';

const VALID_CPF = '52998224725';

const buildPayment = (
  overrides: Partial<Parameters<typeof Payment.create>> = [],
) =>
  Payment.create(
    'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
    VALID_CPF,
    'Mensalidade de outubro',
    149.9,
    PaymentMethod.PIX,
    ...(overrides as []),
  );

describe('Payment', () => {
  it('deve criar um pagamento PENDING removendo a máscara do CPF', () => {
    const payment = Payment.create(
      'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
      '529.982.247-25',
      'Mensalidade',
      10,
      PaymentMethod.PIX,
    );

    expect(payment.cpf).toBe(VALID_CPF);
    expect(payment.status).toBe(PaymentStatus.PENDING);
    expect(payment.isPix()).toBe(true);
  });

  it('deve rejeitar CPF inválido', () => {
    expect(() =>
      Payment.create(
        'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
        '11111111111',
        'Mensalidade',
        10,
        PaymentMethod.PIX,
      ),
    ).toThrow(InvalidCpfException);
  });

  it('deve rejeitar valor fora do intervalo permitido', () => {
    expect(() =>
      Payment.create(
        'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
        VALID_CPF,
        'Mensalidade',
        0,
        PaymentMethod.PIX,
      ),
    ).toThrow(InvalidPaymentAmountException);
  });

  it('deve permitir a transição de PENDING para PAID', () => {
    const paid = buildPayment().transitionTo(PaymentStatus.PAID);

    expect(paid.status).toBe(PaymentStatus.PAID);
    expect(paid.canTransitionTo(PaymentStatus.FAIL)).toBe(false);
  });

  it('deve recusar a transição a partir de um estado final', () => {
    const paid = buildPayment().transitionTo(PaymentStatus.PAID);

    expect(() => paid.transitionTo(PaymentStatus.FAIL)).toThrow(
      InvalidPaymentStatusTransitionException,
    );
  });
});

describe('Payment.withDescription', () => {
  const base = () =>
    Payment.create(
      'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
      VALID_CPF,
      'Mensalidade',
      10,
      PaymentMethod.PIX,
    );

  it('deve devolver nova instância com a descrição trocada', () => {
    expect(base().withDescription('Nova').description).toBe('Nova');
  });

  it('deve devolver a mesma instância quando a descrição não muda', () => {
    const payment = base();
    expect(payment.withDescription('Mensalidade')).toBe(payment);
  });

  it('deve recusar descrição vazia', () => {
    expect(() => base().withDescription('   ')).toThrow(
      InvalidPaymentDescriptionException,
    );
  });

  it('deve recusar descrição longa demais', () => {
    expect(() => base().withDescription('a'.repeat(256))).toThrow(
      InvalidPaymentDescriptionException,
    );
  });
});

describe('withCheckout', () => {
  const build = (): Payment =>
    Payment.create(
      'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
      '52998224725',
      'Mensalidade',
      149.9,
      PaymentMethod.CREDIT_CARD,
    );

  it('deve vincular externalId e checkoutUrl juntos', () => {
    const linked = build().withCheckout('pref-1', 'https://mp.com/go');

    expect(linked.externalId).toBe('pref-1');
    expect(linked.checkoutUrl).toBe('https://mp.com/go');
  });

  it('deve devolver uma nova instância, sem tocar na original', () => {
    const payment = build();
    const linked = payment.withCheckout('pref-1', 'https://mp.com/go');

    expect(linked).not.toBe(payment);
    expect(payment.externalId).toBeNull();
    expect(payment.checkoutUrl).toBeNull();
  });

  it('deve preservar o checkoutUrl ao mudar de status', () => {
    const linked = build().withCheckout('pref-1', 'https://mp.com/go');

    expect(linked.transitionTo(PaymentStatus.PAID).checkoutUrl).toBe(
      'https://mp.com/go',
    );
  });

  it('deve preservar o checkoutUrl ao mudar a descrição', () => {
    const linked = build().withCheckout('pref-1', 'https://mp.com/go');

    expect(linked.withDescription('outra').checkoutUrl).toBe(
      'https://mp.com/go',
    );
  });

  it('deve preservar a versão carregada em toda cópia', () => {
    const loaded = new Payment(
      'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
      VALID_CPF,
      'Mensalidade',
      10,
      PaymentMethod.PIX,
      PaymentStatus.PENDING,
      new Date(),
      new Date(),
      null,
      null,
      7,
    );

    expect(loaded.transitionTo(PaymentStatus.PAID).version).toBe(7);
    expect(loaded.withDescription('outra').version).toBe(7);
    expect(loaded.withCheckout('pref-1', 'https://mp.com/go').version).toBe(7);
  });

  it.each([
    [PaymentMethod.PIX, true],
    [PaymentMethod.CREDIT_CARD, false],
  ])(
    'deve dizer se %s aceita mudança manual de status (%s)',
    (paymentMethod, expected) => {
      const payment = Payment.create(
        'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
        VALID_CPF,
        'Mensalidade',
        10,
        paymentMethod,
      );

      expect(payment.allowsManualStatusChange()).toBe(expected);
    },
  );
});
