import {
  allHandlersFinished,
  condition,
  log,
  proxyActivities,
  setHandler,
} from '@temporalio/workflow';

import type { PaymentActivities } from '../activities/payment.activities';

import {
  checkoutSettledUpdate,
  CreditCardPaymentInput,
  CreditCardPaymentResult,
  CreditCardPaymentState,
  FinalPaymentStatus,
  paymentNotificationSignal,
  paymentStateQuery,
} from './credit-card-payment.definitions';

const { registerPayment, startCheckout, markPaymentFailed } =
  proxyActivities<PaymentActivities>({
    startToCloseTimeout: '30 seconds',
    retry: {
      initialInterval: '2 seconds',
      backoffCoefficient: 2,
      maximumInterval: '1 minute',
      maximumAttempts: 8,
    },
  });

const { applyNotification } = proxyActivities<PaymentActivities>({
  startToCloseTimeout: '30 seconds',
  retry: { initialInterval: '5 seconds', maximumInterval: '5 minutes' },
});

const { reconcilePayment } = proxyActivities<PaymentActivities>({
  startToCloseTimeout: '30 seconds',
  retry: { initialInterval: '5 seconds', maximumAttempts: 3 },
});

export async function creditCardPaymentWorkflow(
  input: CreditCardPaymentInput,
): Promise<CreditCardPaymentResult> {
  const paymentId = input.payment.id;

  const state: CreditCardPaymentState = {
    stage: 'REGISTERING',
    status: 'PENDING',
    externalId: null,
    checkoutUrl: null,
  };
  const notifications: string[] = [];
  let checkoutSettled = false;

  setHandler(paymentNotificationSignal, (providerPaymentId) => {
    notifications.push(providerPaymentId);
  });
  setHandler(paymentStateQuery, () => state);
  setHandler(checkoutSettledUpdate, async () => {
    await condition(() => checkoutSettled);
    return state;
  });

  const finish = async (
    status: FinalPaymentStatus | null,
  ): Promise<CreditCardPaymentResult> => {
    state.stage = 'COMPLETED';
    state.status = status ?? 'PENDING';
    checkoutSettled = true;
    await condition(allHandlersFinished);
    return {
      paymentId,
      status: state.status,
      outcome: status ? 'SETTLED' : 'EXPIRED',
    };
  };

  await registerPayment(input.payment);

  state.stage = 'CREATING_CHECKOUT';
  try {
    const checkout = await startCheckout(paymentId);
    state.externalId = checkout.externalId;
    state.checkoutUrl = checkout.checkoutUrl;
  } catch (error) {
    log.error('Não foi possível criar a preferência; marcando FAIL.', {
      paymentId,
      error: (error as Error).message,
    });
    return finish(await markPaymentFailed(paymentId));
  }

  state.stage = 'AWAITING_PAYMENT';
  checkoutSettled = true;

  const deadline = Date.now() + input.paymentTimeoutMs;
  let final: FinalPaymentStatus | null = null;

  while (final === null) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const notified = await condition(
      () => notifications.length > 0,
      Math.min(input.pollIntervalMs, remaining),
    );

    try {
      final = notified
        ? await applyNotification(notifications.shift()!)
        : await reconcilePayment(paymentId);
    } catch (error) {
      log.warn('Falha ao consultar o status; tentando na próxima volta.', {
        paymentId,
        error: (error as Error).message,
      });
    }
  }

  if (final === null) {
    final = await reconcilePayment(paymentId).catch(() => null);
  }

  return finish(final);
}
