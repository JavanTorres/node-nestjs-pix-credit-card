import { CreditCardPaymentOrchestratorPort } from '@application/ports/credit-card-payment-orchestrator.port';
import { CreditCardPaymentStrategy } from '@application/strategies/credit-card-payment.strategy';
import { PixPaymentStrategy } from '@application/strategies/pix-payment.strategy';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';
import { PaymentMethod, PaymentStatus } from '@domain/enums';
import {
  InvalidCpfException,
  UnsupportedPaymentMethodException,
} from '@domain/exceptions';

import { CreatePaymentUseCase } from '../create-payment.usecase';

const VALID_CPF = '52998224725';

const input = (paymentMethod: PaymentMethod, cpf = VALID_CPF) => ({
  cpf,
  description: 'Mensalidade',
  amount: 149.9,
  paymentMethod,
});

describe('CreatePaymentUseCase', () => {
  let useCase: CreatePaymentUseCase;
  let repo: jest.Mocked<PaymentRepositoryContract>;
  let orchestrator: jest.Mocked<CreditCardPaymentOrchestratorPort>;

  beforeEach(() => {
    repo = {
      create: jest.fn(async (payment: Payment) => payment),
    } as unknown as jest.Mocked<PaymentRepositoryContract>;

    orchestrator = {
      start: jest.fn(async (payment: Payment) =>
        payment.withCheckout('pref-123', 'https://mp.com/pref-123'),
      ),
      notify: jest.fn(),
    } as unknown as jest.Mocked<CreditCardPaymentOrchestratorPort>;

    useCase = new CreatePaymentUseCase([
      new PixPaymentStrategy(repo),
      new CreditCardPaymentStrategy(orchestrator),
    ]);
  });

  describe('PIX', () => {
    it('deve gravar como PENDING sem acionar o orquestrador', async () => {
      const result = await useCase.execute(input(PaymentMethod.PIX));

      expect(repo.create).toHaveBeenCalledTimes(1);
      expect(orchestrator.start).not.toHaveBeenCalled();
      expect(result.status).toBe(PaymentStatus.PENDING);
      expect(result.paymentMethod).toBe(PaymentMethod.PIX);
    });

    it('não deve gerar URL de checkout', async () => {
      const result = await useCase.execute(input(PaymentMethod.PIX));

      expect(result.checkoutUrl).toBeNull();
    });
  });

  describe('CREDIT_CARD', () => {
    it('deve entregar o pagamento PENDING ao orquestrador', async () => {
      await useCase.execute(input(PaymentMethod.CREDIT_CARD));

      const payment = orchestrator.start.mock.calls[0][0];
      expect(payment.status).toBe(PaymentStatus.PENDING);
      expect(payment.paymentMethod).toBe(PaymentMethod.CREDIT_CARD);
    });

    it('não deve gravar direto: quem registra é o orquestrador', async () => {
      await useCase.execute(input(PaymentMethod.CREDIT_CARD));

      expect(repo.create).not.toHaveBeenCalled();
    });

    it('deve devolver o que o orquestrador devolver', async () => {
      const result = await useCase.execute(input(PaymentMethod.CREDIT_CARD));

      expect(result.externalId).toBe('pref-123');
      expect(result.checkoutUrl).toBe('https://mp.com/pref-123');
    });

    it('deve propagar a falha do orquestrador', async () => {
      orchestrator.start.mockRejectedValue(new Error('gateway indisponível'));

      await expect(
        useCase.execute(input(PaymentMethod.CREDIT_CARD)),
      ).rejects.toThrow('gateway indisponível');
    });
  });

  it('deve recusar um meio de pagamento sem estratégia registrada', async () => {
    useCase = new CreatePaymentUseCase([new PixPaymentStrategy(repo)]);

    await expect(
      useCase.execute(input(PaymentMethod.CREDIT_CARD)),
    ).rejects.toThrow(UnsupportedPaymentMethodException);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('deve validar a entrada antes de qualquer efeito colateral', async () => {
    await expect(
      useCase.execute(input(PaymentMethod.CREDIT_CARD, '11111111111')),
    ).rejects.toThrow(InvalidCpfException);

    expect(repo.create).not.toHaveBeenCalled();
    expect(orchestrator.start).not.toHaveBeenCalled();
  });
});
