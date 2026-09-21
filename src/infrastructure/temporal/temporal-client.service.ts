import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Client, Connection } from '@temporalio/client';

import { temporalConfig } from '@config/configuration';

@Injectable()
export class TemporalClientService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(TemporalClientService.name);
  private connection: Connection | null = null;
  private instance: Client | null = null;

  constructor(
    @Inject(temporalConfig.KEY)
    private readonly config: ConfigType<typeof temporalConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      this.connection = await Connection.connect({
        address: this.config.address,
      });
    } catch (error) {
      throw new Error(
        `Temporal indisponível em ${this.config.address}: ` +
          `${(error as Error).message}. Suba o servidor ` +
          '(`docker compose up -d`) ou desligue TEMPORAL_ENABLED.',
      );
    }

    this.instance = new Client({
      connection: this.connection,
      namespace: this.config.namespace,
    });

    this.logger.log(
      `Conectado ao Temporal em ${this.config.address} ` +
        `(namespace ${this.config.namespace}).`,
    );
  }

  get client(): Client {
    if (!this.instance) {
      throw new Error('Cliente do Temporal não inicializado.');
    }
    return this.instance;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.connection?.close();
  }
}
