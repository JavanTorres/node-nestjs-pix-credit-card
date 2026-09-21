import { Payment } from '@domain/entities/payment.entity';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';
import { PaymentMethod, PaymentStatus } from '@domain/enums';

import {
  DEFAULT_PAGINATION,
  FindAllPaymentsUseCase,
} from '../find-all-payments.usecase';

const buildPayment = (id: string): Payment =>
  Payment.create(id, '52998224725', 'Mensalidade', 10, PaymentMethod.PIX);

describe('FindAllPaymentsUseCase', () => {
  let useCase: FindAllPaymentsUseCase;
  let repo: jest.Mocked<PaymentRepositoryContract>;

  beforeEach(() => {
    repo = {
      findAll: jest.fn(),
    } as unknown as jest.Mocked<PaymentRepositoryContract>;

    useCase = new FindAllPaymentsUseCase(repo);
  });

  it('deve repassar filtros e paginação ao repositório', async () => {
    repo.findAll.mockResolvedValue({ items: [], total: 0 });

    const filters = {
      cpf: '52998224725',
      paymentMethod: PaymentMethod.CREDIT_CARD,
      status: PaymentStatus.PAID,
    };

    await useCase.execute(filters, { page: 2, limit: 10 });

    expect(repo.findAll).toHaveBeenCalledWith(filters, { page: 2, limit: 10 });
  });

  it('deve devolver a página do repositório', async () => {
    const payments = [
      buildPayment('d2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b'),
      buildPayment('a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d'),
    ];
    repo.findAll.mockResolvedValue({ items: payments, total: 7 });

    await expect(useCase.execute({})).resolves.toEqual({
      items: payments,
      total: 7,
    });
  });

  it('deve usar filtro vazio e a paginação padrão quando nada for informado', async () => {
    repo.findAll.mockResolvedValue({ items: [], total: 0 });

    await useCase.execute();

    expect(repo.findAll).toHaveBeenCalledWith({}, DEFAULT_PAGINATION);
  });
});
