import { Payment } from '@domain/entities/payment.entity';
import { PaymentMethod, PaymentStatus } from '@domain/enums';

import { PaymentMapper } from '../payment.mapper';

const CREATED_AT = new Date('2026-01-01T10:00:00Z');
const UPDATED_AT = new Date('2026-01-02T10:00:00Z');

const buildPayment = (
  externalId: string | null = null,
  checkoutUrl: string | null = null,
): Payment =>
  new Payment(
    'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
    '52998224725',
    'Mensalidade',
    149.9,
    PaymentMethod.CREDIT_CARD,
    PaymentStatus.PENDING,
    CREATED_AT,
    UPDATED_AT,
    externalId,
    checkoutUrl,
  );

describe('PaymentMapper', () => {
  it('deve mapear todos os campos da entidade', () => {
    expect(
      PaymentMapper.toResponse(buildPayment('pref-1', 'https://mp.com/go')),
    ).toEqual({
      id: 'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
      cpf: '52998224725',
      description: 'Mensalidade',
      amount: 149.9,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      status: PaymentStatus.PENDING,
      externalId: 'pref-1',
      checkoutUrl: 'https://mp.com/go',
      createdAt: CREATED_AT,
      updatedAt: UPDATED_AT,
    });
  });

  it('deve manter externalId nulo quando não houver', () => {
    expect(PaymentMapper.toResponse(buildPayment()).externalId).toBeNull();
  });

  it('deve manter checkoutUrl nulo quando não houver', () => {
    expect(PaymentMapper.toResponse(buildPayment()).checkoutUrl).toBeNull();
  });

  it('não deve expor campos além dos declarados na resposta', () => {
    expect(
      Object.keys(PaymentMapper.toResponse(buildPayment())).sort(),
    ).toEqual([
      'amount',
      'checkoutUrl',
      'cpf',
      'createdAt',
      'description',
      'externalId',
      'id',
      'paymentMethod',
      'status',
      'updatedAt',
    ]);
  });
});
