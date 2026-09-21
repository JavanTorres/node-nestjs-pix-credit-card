import { Payment } from '@domain/entities/payment.entity';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';
import { PaymentMethod, PaymentStatus } from '@domain/enums';

import { ApplyGatewayPaymentUseCase } from '../apply-gateway-payment.usecase';

const VALID_CPF = '52998224725';
const PAYMENT_ID = 'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b';

const buildPayment = (status = PaymentStatus.PENDING): Payment =>
  Payment.create(
    PAYMENT_ID,
    VALID_CPF,
    'Mensalidade',
    149.9,
    PaymentMethod.CREDIT_CARD,
    status,
  );

describe('ApplyGatewayPaymentUseCase', () => {
  let useCase: ApplyGatewayPaymentUseCase;
  let repo: jest.Mocked<PaymentRepositoryContract>;

  beforeEach(() => {
    repo = {
      findById: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<PaymentRepositoryContract>;

    const logger = { log: jest.fn(), warn: jest.fn() };

    useCase = new ApplyGatewayPaymentUseCase(repo, logger);
  });

  it('deve promover o pagamento para PAID quando o provedor aprovar', async () => {
    const gatewayPayment = {
      providerPaymentId: 'mp-1',
      externalReference: PAYMENT_ID,
      status: PaymentStatus.PAID,
    };
    repo.findById.mockResolvedValue(buildPayment());
    repo.update.mockImplementation(async (payment) => payment);

    const result = await useCase.execute(gatewayPayment);

    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(result?.status).toBe(PaymentStatus.PAID);
  });

  it('deve marcar como FAIL quando o provedor recusar', async () => {
    const gatewayPayment = {
      providerPaymentId: 'mp-2',
      externalReference: PAYMENT_ID,
      status: PaymentStatus.FAIL,
    };
    repo.findById.mockResolvedValue(buildPayment());
    repo.update.mockImplementation(async (payment) => payment);

    const result = await useCase.execute(gatewayPayment);

    expect(result?.status).toBe(PaymentStatus.FAIL);
  });

  it('não deve gravar quando a transação ainda está em andamento', async () => {
    const gatewayPayment = {
      providerPaymentId: 'mp-3',
      externalReference: PAYMENT_ID,
      status: null,
    };
    repo.findById.mockResolvedValue(buildPayment());

    const result = await useCase.execute(gatewayPayment);

    expect(repo.update).not.toHaveBeenCalled();
    expect(result?.status).toBe(PaymentStatus.PENDING);
  });

  it('deve ser idempotente quando a notificação se repete', async () => {
    const gatewayPayment = {
      providerPaymentId: 'mp-4',
      externalReference: PAYMENT_ID,
      status: PaymentStatus.PAID,
    };
    repo.findById.mockResolvedValue(buildPayment(PaymentStatus.PAID));

    const result = await useCase.execute(gatewayPayment);

    expect(repo.update).not.toHaveBeenCalled();
    expect(result?.status).toBe(PaymentStatus.PAID);
  });

  it('não deve lançar quando o pagamento já está num estado final diferente', async () => {
    const gatewayPayment = {
      providerPaymentId: 'mp-5',
      externalReference: PAYMENT_ID,
      status: PaymentStatus.PAID,
    };
    repo.findById.mockResolvedValue(buildPayment(PaymentStatus.FAIL));

    const result = await useCase.execute(gatewayPayment);

    expect(repo.update).not.toHaveBeenCalled();
    expect(result?.status).toBe(PaymentStatus.FAIL);
  });

  it('deve ignorar notificação de pagamento inexistente', async () => {
    const gatewayPayment = {
      providerPaymentId: 'mp-6',
      externalReference: 'nao-existe',
      status: PaymentStatus.PAID,
    };
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute(gatewayPayment)).resolves.toBeNull();
    expect(repo.update).not.toHaveBeenCalled();
  });
});
