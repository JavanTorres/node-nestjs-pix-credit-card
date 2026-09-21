import { Connection } from '@temporalio/client';
import { NativeConnection } from '@temporalio/worker';

import { TemporalClientService } from '../temporal-client.service';
import { TemporalWorkerService } from '../temporal-worker.service';

const config = (overrides: Record<string, unknown> = {}) => ({
  enabled: false,
  address: 'localhost:7233',
  namespace: 'default',
  taskQueue: 'payments',
  runWorker: true,
  checkoutWaitMs: 15000,
  pollIntervalSeconds: 30,
  paymentTimeoutMinutes: 60,
  ...overrides,
});

describe('Serviços do Temporal', () => {
  let connect: jest.SpyInstance;
  let nativeConnect: jest.SpyInstance;

  beforeEach(() => {
    connect = jest.spyOn(Connection, 'connect');
    nativeConnect = jest.spyOn(NativeConnection, 'connect');
  });

  afterEach(() => {
    connect.mockRestore();
    nativeConnect.mockRestore();
  });

  describe('TemporalClientService', () => {
    it('não deve conectar quando o Temporal está desligado', async () => {
      const service = new TemporalClientService(config());

      await service.onModuleInit();

      expect(connect).not.toHaveBeenCalled();
      expect(() => service.client).toThrow('não inicializado');
    });

    it('deve derrubar o boot com uma mensagem acionável se o servidor não responde', async () => {
      connect.mockRejectedValue(new Error('connection refused'));
      const service = new TemporalClientService(config({ enabled: true }));

      await expect(service.onModuleInit()).rejects.toThrow(
        /docker compose up -d/,
      );
    });

    it('deve encerrar sem erro mesmo sem ter conectado', async () => {
      await expect(
        new TemporalClientService(config()).onApplicationShutdown(),
      ).resolves.toBeUndefined();
    });
  });

  describe('TemporalWorkerService', () => {
    const build = (overrides: Record<string, unknown>) =>
      new TemporalWorkerService(
        config(overrides),
        {} as never,
        {} as never,
        {} as never,
        {} as never,
      );

    it('não deve subir quando o Temporal está desligado', async () => {
      await build({ enabled: false }).onApplicationBootstrap();

      expect(nativeConnect).not.toHaveBeenCalled();
    });

    it('não deve subir no processo da API quando o worker roda à parte', async () => {
      await build({ enabled: true, runWorker: false }).onApplicationBootstrap();

      expect(nativeConnect).not.toHaveBeenCalled();
    });

    it('deve encerrar sem erro quando nunca subiu', async () => {
      await expect(
        build({ enabled: false }).onApplicationShutdown(),
      ).resolves.toBeUndefined();
    });
  });
});
