import { defineQuery, defineSignal, defineUpdate } from '@temporalio/workflow';

export const CREDIT_CARD_PAYMENT_WORKFLOW = 'creditCardPaymentWorkflow';

export type WorkflowPaymentStatus = 'PENDING' | 'PAID' | 'FAIL';
export type FinalPaymentStatus = Exclude<WorkflowPaymentStatus, 'PENDING'>;

export interface PaymentSnapshot {
  id: string;
  cpf: string;
  description: string;
  amount: number;
  paymentMethod: string;
  createdAt: string;
}

export interface CreditCardPaymentInput {
  payment: PaymentSnapshot;
  pollIntervalMs: number;
  paymentTimeoutMs: number;
}

export type CreditCardPaymentStage =
  'REGISTERING' | 'CREATING_CHECKOUT' | 'AWAITING_PAYMENT' | 'COMPLETED';

export interface CreditCardPaymentState {
  stage: CreditCardPaymentStage;
  status: WorkflowPaymentStatus;
  externalId: string | null;
  checkoutUrl: string | null;
}

export interface CreditCardPaymentResult {
  paymentId: string;
  status: WorkflowPaymentStatus;
  outcome: 'SETTLED' | 'EXPIRED';
}

export const paymentNotificationSignal = defineSignal<[string]>(
  'paymentNotification',
);

export const checkoutSettledUpdate =
  defineUpdate<CreditCardPaymentState>('checkoutSettled');

export const paymentStateQuery =
  defineQuery<CreditCardPaymentState>('paymentState');

export const workflowIdFor = (paymentId: string): string =>
  `payment-${paymentId}`;
