import { Payment } from '@domain/entities/payment.entity';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';
import { PaymentMethod, PaymentStatus } from '@domain/enums';
import {
  InvalidPaymentStatusTransitionException,
  ManualStatusChangeNotAllowedException,
  PaymentNotFoundException,
} from '@domain/exceptions';

import { UpdatePaymentUseCase } from '../update-payment.usecase';

const PAYMENT_ID = 'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b';

const buildPayment = (
  status = PaymentStatus.PENDING,
  paymentMethod = PaymentMethod.PIX,
): Payment =>
  Payment.create(
    PAYMENT_ID,
    '52998224725',
    'Mensalidade',
    149.9,
    paymentMethod,
    status,
  );

describe('UpdatePaymentUseCase', () => {
  let useCase: UpdatePaymentUseCase;
  let repo: jest.Mocked<PaymentRepositoryContract>;

  beforeEach(() => {
    repo = {
      findById: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<PaymentRepositoryContract>;

    useCase = new UpdatePaymentUseCase(repo);
    repo.update.mockImplementation(async (payment) => payment);
  });

  it('deve atualizar o status', async () => {
    repo.findById.mockResolvedValue(buildPayment());

    const result = await useCase.execute(PAYMENT_ID, {
      status: PaymentStatus.PAID,
    });

    expect(result.status).toBe(PaymentStatus.PAID);
  });

  it('deve atualizar a descrição', async () => {
    repo.findById.mockResolvedValue(buildPayment());

    const result = await useCase.execute(PAYMENT_ID, {
      description: 'Mensalidade revisada',
    });

    expect(result.description).toBe('Mensalidade revisada');
    expect(result.status).toBe(PaymentStatus.PENDING);
  });

  it('deve atualizar status e descrição juntos', async () => {
    repo.findById.mockResolvedValue(buildPayment());

    const result = await useCase.execute(PAYMENT_ID, {
      description: 'Quitado',
      status: PaymentStatus.PAID,
    });

    expect(result.description).toBe('Quitado');
    expect(result.status).toBe(PaymentStatus.PAID);
  });

  it('deve preservar os demais campos ao trocar a descrição', async () => {
    const original = buildPayment();
    repo.findById.mockResolvedValue(original);

    const result = await useCase.execute(PAYMENT_ID, { description: 'Nova' });

    expect(result.id).toBe(original.id);
    expect(result.cpf).toBe(original.cpf);
    expect(result.amount).toBe(original.amount);
    expect(result.paymentMethod).toBe(original.paymentMethod);
    expect(result.createdAt).toBe(original.createdAt);
  });

  it('deve recusar transição a partir de estado final', async () => {
    repo.findById.mockResolvedValue(buildPayment(PaymentStatus.PAID));

    await expect(
      useCase.execute(PAYMENT_ID, { status: PaymentStatus.FAIL }),
    ).rejects.toThrow(InvalidPaymentStatusTransitionException);

    expect(repo.update).not.toHaveBeenCalled();
  });

  describe('CREDIT_CARD', () => {
    const card = () =>
      buildPayment(PaymentStatus.PENDING, PaymentMethod.CREDIT_CARD);

    it.each([PaymentStatus.PAID, PaymentStatus.FAIL])(
      'não deve aceitar mudança manual de status para %s',
      async (status) => {
        repo.findById.mockResolvedValue(card());

        await expect(useCase.execute(PAYMENT_ID, { status })).rejects.toThrow(
          ManualStatusChangeNotAllowedException,
        );
        expect(repo.update).not.toHaveBeenCalled();
      },
    );

    it('deve aceitar reenviar o status atual junto com a descrição', async () => {
      repo.findById.mockResolvedValue(card());

      const result = await useCase.execute(PAYMENT_ID, {
        status: PaymentStatus.PENDING,
        description: 'Compra revisada',
      });

      expect(result.description).toBe('Compra revisada');
      expect(result.status).toBe(PaymentStatus.PENDING);
    });
  });

  it('deve lançar quando o pagamento não existir', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute(PAYMENT_ID, {})).rejects.toThrow(
      PaymentNotFoundException,
    );
  });

  it('deve lançar quando o repositório não encontrar na hora de gravar', async () => {
    repo.findById.mockResolvedValue(buildPayment());
    repo.update.mockResolvedValue(null);

    await expect(
      useCase.execute(PAYMENT_ID, { status: PaymentStatus.PAID }),
    ).rejects.toThrow(PaymentNotFoundException);
  });
});
