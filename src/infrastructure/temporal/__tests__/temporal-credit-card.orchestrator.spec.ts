import { WithStartWorkflowOperation } from '@temporalio/client';

import { PaymentGatewayPort } from '@application/ports/payment-gateway.port';
import { ApplyGatewayPaymentUseCase } from '@application/usecases/payment/apply-gateway-payment.usecase';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';
import { PaymentMethod, PaymentStatus } from '@domain/enums';

import { TemporalClientService } from '../temporal-client.service';
import { TemporalCreditCardOrchestrator } from '../temporal-credit-card.orchestrator';
import {
  checkoutSettledUpdate,
  CreditCardPaymentInput,
  paymentNotificationSignal,
} from '../workflows/credit-card-payment.definitions';

const PAYMENT_ID = 'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b';

const config = {
  enabled: true,
  address: 'localhost:7233',
  namespace: 'default',
  taskQueue: 'payments',
  runWorker: true,
  checkoutWaitMs: 50,
  pollIntervalSeconds: 30,
  paymentTimeoutMinutes: 60,
};

const buildPayment = (): Payment =>
  Payment.create(
    PAYMENT_ID,
    '52998224725',
    'Compra',
    99.9,
    PaymentMethod.CREDIT_CARD,
  );

const gatewayPayment = {
  providerPaymentId: 'mp-1',
  externalReference: PAYMENT_ID,
  status: PaymentStatus.PAID,
};

describe('TemporalCreditCardOrchestrator', () => {
  let orchestrator: TemporalCreditCardOrchestrator;
  let executeUpdateWithStart: jest.Mock;
  let signal: jest.Mock;
  let getHandle: jest.Mock;
  let repo: jest.Mocked<PaymentRepositoryContract>;
  let gateway: jest.Mocked<PaymentGatewayPort>;
  let applyGatewayPayment: jest.Mocked<ApplyGatewayPaymentUseCase>;

  beforeEach(() => {
    executeUpdateWithStart = jest.fn().mockResolvedValue({});
    signal = jest.fn().mockResolvedValue(undefined);
    getHandle = jest.fn(() => ({ signal }));

    const temporal = {
      client: { workflow: { executeUpdateWithStart, getHandle } },
    } as unknown as TemporalClientService;

    repo = {
      findById: jest.fn(async () =>
        buildPayment().withCheckout('pref-1', 'https://mp.com/1'),
      ),
    } as unknown as jest.Mocked<PaymentRepositoryContract>;

    gateway = {
      fetchPayment: jest.fn().mockResolvedValue(gatewayPayment),
    } as unknown as jest.Mocked<PaymentGatewayPort>;

    applyGatewayPayment = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<ApplyGatewayPaymentUseCase>;

    orchestrator = new TemporalCreditCardOrchestrator(
      config,
      temporal,
      repo,
      gateway,
      applyGatewayPayment,
    );
  });

  describe('start', () => {
    const startOperation = (): WithStartWorkflowOperation<never> =>
      executeUpdateWithStart.mock.calls[0][1].startWorkflowOperation;

    it('deve iniciar o workflow e esperar o checkout na mesma chamada', async () => {
      await orchestrator.start(buildPayment());

      expect(executeUpdateWithStart).toHaveBeenCalledTimes(1);
      expect(executeUpdateWithStart.mock.calls[0][0]).toBe(
        checkoutSettledUpdate,
      );
    });

    it('deve usar um workflow por pagamento, reaproveitando o existente', async () => {
      await orchestrator.start(buildPayment());

      const { options } = startOperation();
      expect(options.workflowId).toBe(`payment-${PAYMENT_ID}`);
      expect(options.workflowIdConflictPolicy).toBe('USE_EXISTING');
      expect(options.taskQueue).toBe('payments');
    });

    it('deve passar ao workflow os dados e os prazos em milissegundos', async () => {
      const payment = buildPayment();

      await orchestrator.start(payment);

      const [input] = startOperation().options.args as [CreditCardPaymentInput];
      expect(input.payment).toEqual({
        id: PAYMENT_ID,
        cpf: '52998224725',
        description: 'Compra',
        amount: 99.9,
        paymentMethod: 'CREDIT_CARD',
        createdAt: payment.createdAt.toISOString(),
      });
      expect(input.pollIntervalMs).toBe(30_000);
      expect(input.paymentTimeoutMs).toBe(3_600_000);
    });

    it('deve devolver o pagamento como gravado pelo workflow', async () => {
      const result = await orchestrator.start(buildPayment());

      expect(repo.findById).toHaveBeenCalledWith(PAYMENT_ID);
      expect(result.checkoutUrl).toBe('https://mp.com/1');
    });

    it('deve devolver o pagamento sem checkout quando o prazo de espera vence', async () => {
      executeUpdateWithStart.mockReturnValue(new Promise(() => undefined));

      const payment = buildPayment();
      const result = await orchestrator.start(payment);

      expect(result).toBe(payment);
      expect(result.checkoutUrl).toBeNull();
      expect(repo.findById).not.toHaveBeenCalled();
    });

    it('deve propagar a falha quando o workflow nem pôde ser iniciado', async () => {
      executeUpdateWithStart.mockRejectedValue(new Error('UNAVAILABLE'));

      await expect(orchestrator.start(buildPayment())).rejects.toThrow(
        'UNAVAILABLE',
      );
    });
  });

  describe('notify', () => {
    it('deve sinalizar o workflow do pagamento referenciado', async () => {
      await orchestrator.notify('mp-1');

      expect(gateway.fetchPayment).toHaveBeenCalledWith('mp-1');
      expect(getHandle).toHaveBeenCalledWith(`payment-${PAYMENT_ID}`);
      expect(signal).toHaveBeenCalledWith(paymentNotificationSignal, 'mp-1');
      expect(applyGatewayPayment.execute).not.toHaveBeenCalled();
    });

    it('deve processar direto quando o workflow não está mais rodando', async () => {
      signal.mockRejectedValue(
        new Error('workflow execution already completed'),
      );

      await orchestrator.notify('mp-1');

      expect(applyGatewayPayment.execute).toHaveBeenCalledWith(gatewayPayment);
    });

    it('não deve engolir a falha da consulta ao provedor', async () => {
      gateway.fetchPayment.mockRejectedValue(new Error('provedor fora'));

      await expect(orchestrator.notify('mp-1')).rejects.toThrow(
        'provedor fora',
      );
      expect(signal).not.toHaveBeenCalled();
    });
  });
});
