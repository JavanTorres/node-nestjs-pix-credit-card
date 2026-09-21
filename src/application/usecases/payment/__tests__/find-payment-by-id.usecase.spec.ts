import { Payment } from '@domain/entities/payment.entity';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';
import { PaymentMethod } from '@domain/enums';
import { PaymentNotFoundException } from '@domain/exceptions';

import { FindPaymentByIdUseCase } from '../find-payment-by-id.usecase';

const PAYMENT_ID = 'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b';

describe('FindPaymentByIdUseCase', () => {
  let useCase: FindPaymentByIdUseCase;
  let repo: jest.Mocked<PaymentRepositoryContract>;

  beforeEach(() => {
    repo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<PaymentRepositoryContract>;

    useCase = new FindPaymentByIdUseCase(repo);
  });

  it('deve devolver o pagamento encontrado', async () => {
    const payment = Payment.create(
      PAYMENT_ID,
      '52998224725',
      'Mensalidade',
      149.9,
      PaymentMethod.PIX,
    );
    repo.findById.mockResolvedValue(payment);

    await expect(useCase.execute(PAYMENT_ID)).resolves.toBe(payment);
    expect(repo.findById).toHaveBeenCalledWith(PAYMENT_ID);
  });

  it('deve lançar PaymentNotFoundException quando não existir', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute(PAYMENT_ID)).rejects.toThrow(
      PaymentNotFoundException,
    );
  });

  it('deve citar o id na mensagem do erro', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute(PAYMENT_ID)).rejects.toThrow(PAYMENT_ID);
  });
});
