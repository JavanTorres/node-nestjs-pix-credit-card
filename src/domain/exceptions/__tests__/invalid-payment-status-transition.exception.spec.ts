import { PaymentStatus } from '@domain/enums';

import { ConflictDomainException } from '../domain.exception';
import { InvalidPaymentStatusTransitionException } from '../invalid-payment-status-transition.exception';

describe('InvalidPaymentStatusTransitionException', () => {
  const build = () =>
    new InvalidPaymentStatusTransitionException(
      PaymentStatus.PAID,
      PaymentStatus.FAIL,
    );

  it('deve ser uma exceção de conflito', () => {
    expect(build()).toBeInstanceOf(ConflictDomainException);
  });

  it('deve citar a origem e o destino da transição', () => {
    expect(build().message).toBe('Transição de status inválida: PAID -> FAIL.');
  });

  it('deve expor origem e destino', () => {
    expect(build().from).toBe(PaymentStatus.PAID);
    expect(build().to).toBe(PaymentStatus.FAIL);
  });
});
