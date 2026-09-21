import { NotFoundDomainException } from '../domain.exception';
import { PaymentNotFoundException } from '../payment-not-found.exception';

describe('PaymentNotFoundException', () => {
  const ID = 'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b';

  it('deve ser uma exceção de "não encontrado"', () => {
    expect(new PaymentNotFoundException(ID)).toBeInstanceOf(
      NotFoundDomainException,
    );
  });

  it('deve citar o id na mensagem', () => {
    expect(new PaymentNotFoundException(ID).message).toBe(
      `Pagamento ${ID} não encontrado.`,
    );
  });

  it('deve expor o id que falhou', () => {
    expect(new PaymentNotFoundException(ID).paymentId).toBe(ID);
  });

  it('deve carregar o próprio nome', () => {
    expect(new PaymentNotFoundException(ID).name).toBe(
      'PaymentNotFoundException',
    );
  });
});
