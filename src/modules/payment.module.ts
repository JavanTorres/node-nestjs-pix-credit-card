import { Module, Provider } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { SynchronousCreditCardOrchestrator } from '@application/orchestrators/synchronous-credit-card.orchestrator';
import { CreditCardPaymentOrchestratorPort } from '@application/ports/credit-card-payment-orchestrator.port';
import { PaymentGatewayPort } from '@application/ports/payment-gateway.port';
import {
  PAYMENT_METHOD_STRATEGIES,
  PaymentMethodStrategy,
} from '@application/ports/payment-method-strategy.port';
import { CreditCardPaymentStrategy } from '@application/strategies/credit-card-payment.strategy';
import { PixPaymentStrategy } from '@application/strategies/pix-payment.strategy';
import { ApplyGatewayPaymentUseCase } from '@application/usecases/payment/apply-gateway-payment.usecase';
import { CreatePaymentUseCase } from '@application/usecases/payment/create-payment.usecase';
import { FindAllPaymentsUseCase } from '@application/usecases/payment/find-all-payments.usecase';
import { FindPaymentByIdUseCase } from '@application/usecases/payment/find-payment-by-id.usecase';
import { ProcessPaymentNotificationUseCase } from '@application/usecases/payment/process-payment-notification.usecase';
import { ReceivePaymentNotificationUseCase } from '@application/usecases/payment/receive-payment-notification.usecase';
import { ReconcilePaymentUseCase } from '@application/usecases/payment/reconcile-payment.usecase';
import { StartCheckoutUseCase } from '@application/usecases/payment/start-checkout.usecase';
import { UpdatePaymentUseCase } from '@application/usecases/payment/update-payment.usecase';
import { mercadoPagoConfig, temporalConfig } from '@config/configuration';
import { PaymentRepositoryContract } from '@domain/entities/repositories/payment.repository.contract';
import { PaymentRepositoryImpl } from '@infrastructure/database/payment.repository.impl';
import { FakePaymentGateway } from '@infrastructure/gateways/fake-payment.gateway';
import { MercadoPagoGateway } from '@infrastructure/gateways/mercado-pago.gateway';
import { NestLoggerAdapter } from '@infrastructure/logging/nest-logger.adapter';
import { TemporalClientService } from '@infrastructure/temporal/temporal-client.service';
import { TemporalCreditCardOrchestrator } from '@infrastructure/temporal/temporal-credit-card.orchestrator';
import { TemporalWorkerService } from '@infrastructure/temporal/temporal-worker.service';
import { PaymentController } from '@presentation/controllers/payment.controller';
import { MercadoPagoSignatureGuard } from '@presentation/guards/mercado-pago-signature.guard';

import { DatabaseModule } from './database.module';

const applicationProviders: Provider[] = [
  {
    provide: ApplyGatewayPaymentUseCase,
    inject: [PaymentRepositoryContract],
    useFactory: (repository: PaymentRepositoryContract) =>
      new ApplyGatewayPaymentUseCase(
        repository,
        new NestLoggerAdapter(ApplyGatewayPaymentUseCase.name),
      ),
  },
  {
    provide: ProcessPaymentNotificationUseCase,
    inject: [PaymentGatewayPort, ApplyGatewayPaymentUseCase],
    useFactory: (
      gateway: PaymentGatewayPort,
      applyGatewayPayment: ApplyGatewayPaymentUseCase,
    ) => new ProcessPaymentNotificationUseCase(gateway, applyGatewayPayment),
  },
  {
    provide: StartCheckoutUseCase,
    inject: [PaymentRepositoryContract, PaymentGatewayPort],
    useFactory: (
      repository: PaymentRepositoryContract,
      gateway: PaymentGatewayPort,
    ) =>
      new StartCheckoutUseCase(
        repository,
        gateway,
        new NestLoggerAdapter(StartCheckoutUseCase.name),
      ),
  },
  {
    provide: ReconcilePaymentUseCase,
    inject: [
      PaymentRepositoryContract,
      PaymentGatewayPort,
      ApplyGatewayPaymentUseCase,
    ],
    useFactory: (
      repository: PaymentRepositoryContract,
      gateway: PaymentGatewayPort,
      applyGatewayPayment: ApplyGatewayPaymentUseCase,
    ) => new ReconcilePaymentUseCase(repository, gateway, applyGatewayPayment),
  },
  {
    provide: SynchronousCreditCardOrchestrator,
    inject: [
      PaymentRepositoryContract,
      StartCheckoutUseCase,
      ProcessPaymentNotificationUseCase,
    ],
    useFactory: (
      repository: PaymentRepositoryContract,
      startCheckout: StartCheckoutUseCase,
      processPaymentNotification: ProcessPaymentNotificationUseCase,
    ) =>
      new SynchronousCreditCardOrchestrator(
        repository,
        startCheckout,
        processPaymentNotification,
      ),
  },
  {
    provide: PAYMENT_METHOD_STRATEGIES,
    inject: [PaymentRepositoryContract, CreditCardPaymentOrchestratorPort],
    useFactory: (
      repository: PaymentRepositoryContract,
      orchestrator: CreditCardPaymentOrchestratorPort,
    ): PaymentMethodStrategy[] => [
      new PixPaymentStrategy(repository),
      new CreditCardPaymentStrategy(orchestrator),
    ],
  },
  {
    provide: CreatePaymentUseCase,
    inject: [PAYMENT_METHOD_STRATEGIES],
    useFactory: (strategies: PaymentMethodStrategy[]) =>
      new CreatePaymentUseCase(strategies),
  },
  {
    provide: FindPaymentByIdUseCase,
    inject: [PaymentRepositoryContract],
    useFactory: (repository: PaymentRepositoryContract) =>
      new FindPaymentByIdUseCase(repository),
  },
  {
    provide: FindAllPaymentsUseCase,
    inject: [PaymentRepositoryContract],
    useFactory: (repository: PaymentRepositoryContract) =>
      new FindAllPaymentsUseCase(repository),
  },
  {
    provide: UpdatePaymentUseCase,
    inject: [PaymentRepositoryContract],
    useFactory: (repository: PaymentRepositoryContract) =>
      new UpdatePaymentUseCase(repository),
  },
  {
    provide: ReceivePaymentNotificationUseCase,
    inject: [CreditCardPaymentOrchestratorPort],
    useFactory: (orchestrator: CreditCardPaymentOrchestratorPort) =>
      new ReceivePaymentNotificationUseCase(orchestrator),
  },
];

@Module({
  imports: [DatabaseModule],
  controllers: [PaymentController],
  providers: [
    ...applicationProviders,
    MercadoPagoSignatureGuard,
    { provide: PaymentRepositoryContract, useClass: PaymentRepositoryImpl },

    MercadoPagoGateway,
    FakePaymentGateway,
    {
      provide: PaymentGatewayPort,
      inject: [mercadoPagoConfig.KEY, MercadoPagoGateway, FakePaymentGateway],
      useFactory: (
        config: ConfigType<typeof mercadoPagoConfig>,
        mercadoPago: MercadoPagoGateway,
        fake: FakePaymentGateway,
      ): PaymentGatewayPort => (config.accessToken ? mercadoPago : fake),
    },

    TemporalClientService,
    TemporalWorkerService,
    TemporalCreditCardOrchestrator,
    {
      provide: CreditCardPaymentOrchestratorPort,
      inject: [
        temporalConfig.KEY,
        SynchronousCreditCardOrchestrator,
        TemporalCreditCardOrchestrator,
      ],
      useFactory: (
        config: ConfigType<typeof temporalConfig>,
        synchronous: SynchronousCreditCardOrchestrator,
        temporal: TemporalCreditCardOrchestrator,
      ): CreditCardPaymentOrchestratorPort =>
        config.enabled ? temporal : synchronous,
    },
  ],
})
export class PaymentModule {}
