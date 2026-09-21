import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { NativeConnection, Worker } from '@temporalio/worker';

import { ProcessPaymentNotificationUseCase } from '@application/usecases/payment/process-payment-notification.usecase';
import { ReconcilePaymentUseCase } from '@application/usecases/payment/reconcile-payment.usecase';
import { StartCheckoutUseCase } from '@application/usecases/payment/start-checkout.usecase';
import { temporalConfig } from '@config/configuration';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';

import { createPaymentActivities } from './activities/payment.activities';

@Injectable()
export class TemporalWorkerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(TemporalWorkerService.name);
  private connection: NativeConnection | null = null;
  private worker: Worker | null = null;
  private running: Promise<void> | null = null;

  constructor(
    @Inject(temporalConfig.KEY)
    private readonly config: ConfigType<typeof temporalConfig>,
    private readonly paymentRepository: PaymentRepositoryContract,
    private readonly startCheckout: StartCheckoutUseCase,
    private readonly processPaymentNotification: ProcessPaymentNotificationUseCase,
    private readonly reconcilePayment: ReconcilePaymentUseCase,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.enabled || !this.config.runWorker) return;

    this.connection = await NativeConnection.connect({
      address: this.config.address,
    });

    this.worker = await Worker.create({
      connection: this.connection,
      namespace: this.config.namespace,
      taskQueue: this.config.taskQueue,
      workflowsPath: require.resolve('./workflows'),
      activities: createPaymentActivities({
        paymentRepository: this.paymentRepository,
        startCheckout: this.startCheckout,
        processPaymentNotification: this.processPaymentNotification,
        reconcilePayment: this.reconcilePayment,
      }),
    });

    this.running = this.worker.run().catch((error: Error) => {
      this.logger.error(`Worker do Temporal parou: ${error.message}`);
    });

    this.logger.log(
      `Worker do Temporal ouvindo a fila "${this.config.taskQueue}".`,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.worker) return;

    if (this.worker.getState() === 'RUNNING') this.worker.shutdown();
    await this.running;
    await this.connection?.close();
  }
}
