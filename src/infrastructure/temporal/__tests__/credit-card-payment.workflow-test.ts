import { WithStartWorkflowOperation } from '@temporalio/client';
import { ApplicationFailure } from '@temporalio/common';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import {
  bundleWorkflowCode,
  DefaultLogger,
  Runtime,
  Worker,
  WorkflowBundleWithSourceMap,
} from '@temporalio/worker';

import type { PaymentActivities } from '../activities/payment.activities';
import {
  checkoutSettledUpdate,
  CREDIT_CARD_PAYMENT_WORKFLOW,
  CreditCardPaymentInput,
  paymentNotificationSignal,
  paymentStateQuery,
  workflowIdFor,
} from '../workflows/credit-card-payment.definitions';
import type { creditCardPaymentWorkflow } from '../workflows/credit-card-payment.workflow';

let sequence = 0;
let taskQueue = '';

const input = (
  overrides: Partial<CreditCardPaymentInput> = {},
): CreditCardPaymentInput => ({
  payment: {
    id: `pay-${++sequence}`,
    cpf: '52998224725',
    description: 'Compra',
    amount: 99.9,
    paymentMethod: 'CREDIT_CARD',
    createdAt: '2026-09-21T12:00:00.000Z',
  },
  pollIntervalMs: 30_000,
  paymentTimeoutMs: 60 * 60_000,
  ...overrides,
});

type Mocked = { [K in keyof PaymentActivities]: jest.Mock };

const buildActivities = (): Mocked => ({
  registerPayment: jest.fn().mockResolvedValue(undefined),
  startCheckout: jest.fn().mockResolvedValue({
    externalId: 'pref-1',
    checkoutUrl: 'https://mp.com/pref-1',
  }),
  applyNotification: jest.fn().mockResolvedValue('PAID'),
  reconcilePayment: jest.fn().mockResolvedValue(null),
  markPaymentFailed: jest.fn().mockResolvedValue('FAIL'),
});

describe('creditCardPaymentWorkflow', () => {
  let env: TestWorkflowEnvironment;
  let workflowBundle: WorkflowBundleWithSourceMap;

  beforeAll(async () => {
    Runtime.install({ logger: new DefaultLogger('ERROR') });
    env = await TestWorkflowEnvironment.createTimeSkipping();
    workflowBundle = await bundleWorkflowCode({
      workflowsPath: require.resolve('../workflows'),
      logger: new DefaultLogger('ERROR'),
    });
  });

  afterAll(async () => {
    await env?.teardown();
  });

  beforeEach(() => {
    taskQueue = `payments-test-${sequence}`;
  });

  const withWorker = async <T>(
    activities: Mocked,
    fn: () => Promise<T>,
  ): Promise<T> => {
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowBundle,
      activities,
    });
    return worker.runUntil(fn);
  };

  const startWithUpdate = (args: CreditCardPaymentInput) =>
    env.client.workflow.executeUpdateWithStart(checkoutSettledUpdate, {
      startWorkflowOperation: new WithStartWorkflowOperation<
        typeof creditCardPaymentWorkflow
      >(CREDIT_CARD_PAYMENT_WORKFLOW, {
        workflowId: workflowIdFor(args.payment.id),
        taskQueue,
        args: [args],
        workflowIdConflictPolicy: 'USE_EXISTING',
      }),
    });

  const handleOf = (args: CreditCardPaymentInput) =>
    env.client.workflow.getHandle<typeof creditCardPaymentWorkflow>(
      workflowIdFor(args.payment.id),
    );

  const settleByCallback = async (args: CreditCardPaymentInput) => {
    const handle = handleOf(args);
    await handle.signal(paymentNotificationSignal, 'mp-final');
    return handle.result();
  };

  it('deve devolver o checkout na própria chamada de início (Update-with-Start)', async () => {
    const activities = buildActivities();
    const args = input();

    const state = await withWorker(activities, async () => {
      const settled = await startWithUpdate(args);
      await settleByCallback(args);
      return settled;
    });

    expect(state).toMatchObject({
      stage: 'AWAITING_PAYMENT',
      status: 'PENDING',
      externalId: 'pref-1',
      checkoutUrl: 'https://mp.com/pref-1',
    });
    expect(activities.registerPayment).toHaveBeenCalledWith(args.payment);
  });

  it('deve concluir pelo callback: signal → PAID', async () => {
    const activities = buildActivities();
    const args = input();

    const result = await withWorker(activities, async () => {
      await startWithUpdate(args);
      const handle = env.client.workflow.getHandle(
        workflowIdFor(args.payment.id),
      );
      await handle.signal(paymentNotificationSignal, 'mp-42');
      return handle.result();
    });

    expect(result).toEqual({
      paymentId: args.payment.id,
      status: 'PAID',
      outcome: 'SETTLED',
    });
    expect(activities.applyNotification).toHaveBeenCalledWith('mp-42');
  });

  it('deve concluir por polling quando o callback nunca chega', async () => {
    const activities = buildActivities();
    activities.reconcilePayment
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('PAID');
    const args = input();

    const result = await withWorker(activities, async () => {
      await startWithUpdate(args);
      return env.client.workflow
        .getHandle(workflowIdFor(args.payment.id))
        .result();
    });

    expect(result.status).toBe('PAID');
    expect(result.outcome).toBe('SETTLED');
    expect(activities.reconcilePayment).toHaveBeenCalledTimes(3);
    expect(activities.applyNotification).not.toHaveBeenCalled();
  });

  it('deve encerrar como EXPIRED, mantendo PENDING, quando o prazo vence', async () => {
    const activities = buildActivities();
    const args = input();

    const result = await withWorker(activities, async () => {
      await startWithUpdate(args);
      return env.client.workflow
        .getHandle(workflowIdFor(args.payment.id))
        .result();
    });

    expect(result).toEqual({
      paymentId: args.payment.id,
      status: 'PENDING',
      outcome: 'EXPIRED',
    });
    expect(activities.reconcilePayment).toHaveBeenCalledTimes(121);
    expect(activities.markPaymentFailed).not.toHaveBeenCalled();
  });

  it('deve retentar falhas transitórias do Mercado Pago', async () => {
    const activities = buildActivities();
    activities.startCheckout
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockRejectedValueOnce(new Error('HTTP 503'));
    const args = input();

    const state = await withWorker(activities, async () => {
      const settled = await startWithUpdate(args);
      await settleByCallback(args);
      return settled;
    });

    expect(state.checkoutUrl).toBe('https://mp.com/pref-1');
    expect(activities.startCheckout).toHaveBeenCalledTimes(3);
    expect(activities.markPaymentFailed).not.toHaveBeenCalled();
  });

  it('deve marcar FAIL quando a preferência não pode ser criada', async () => {
    const activities = buildActivities();
    activities.startCheckout.mockRejectedValue(
      ApplicationFailure.nonRetryable(
        'HTTP 401',
        'PaymentGatewayHttpException',
      ),
    );
    const args = input();

    const { state, result } = await withWorker(activities, async () => {
      const settled = await startWithUpdate(args);
      const done = await env.client.workflow
        .getHandle(workflowIdFor(args.payment.id))
        .result();
      return { state: settled, result: done };
    });

    expect(state.status).toBe('FAIL');
    expect(state.checkoutUrl).toBeNull();
    expect(result).toEqual({
      paymentId: args.payment.id,
      status: 'FAIL',
      outcome: 'SETTLED',
    });
    expect(activities.startCheckout).toHaveBeenCalledTimes(1);
    expect(activities.markPaymentFailed).toHaveBeenCalledWith(args.payment.id);
  });

  it('deve seguir esperando depois de uma notificação que falhou', async () => {
    const activities = buildActivities();
    activities.applyNotification.mockRejectedValueOnce(
      ApplicationFailure.nonRetryable('pagamento de outro vendedor'),
    );
    activities.reconcilePayment.mockResolvedValueOnce('FAIL');
    const args = input();

    const result = await withWorker(activities, async () => {
      await startWithUpdate(args);
      const handle = env.client.workflow.getHandle(
        workflowIdFor(args.payment.id),
      );
      await handle.signal(paymentNotificationSignal, 'mp-ruim');
      return handle.result();
    });

    expect(result.status).toBe('FAIL');
    expect(activities.applyNotification).toHaveBeenCalledTimes(1);
  });

  it('não deve duplicar nada quando a mesma cobrança é iniciada duas vezes', async () => {
    const activities = buildActivities();
    const args = input();

    await withWorker(activities, async () => {
      const [first, second] = await Promise.all([
        startWithUpdate(args),
        startWithUpdate(args),
      ]);
      expect(first).toEqual(second);
      await settleByCallback(args);
    });

    expect(activities.registerPayment).toHaveBeenCalledTimes(1);
    expect(activities.startCheckout).toHaveBeenCalledTimes(1);
  });

  it('deve expor o estado corrente por query', async () => {
    const activities = buildActivities();
    const args = input();

    const state = await withWorker(activities, async () => {
      await startWithUpdate(args);
      const current = await handleOf(args).query(paymentStateQuery);
      await settleByCallback(args);
      return current;
    });

    expect(state.stage).toBe('AWAITING_PAYMENT');
    expect(state.checkoutUrl).toBe('https://mp.com/pref-1');
  });
});
