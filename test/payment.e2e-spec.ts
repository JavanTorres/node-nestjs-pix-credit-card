import { Module } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PaymentGatewayPort } from '../src/application/ports/payment-gateway.port';
import { PaymentRepositoryContract } from '../src/domain/entities/repositories/payment.repository.contract';
import { FakePaymentGateway } from '../src/infrastructure/gateways/fake-payment.gateway';
import { DatabaseModule } from '../src/modules/database.module';

import { InMemoryPaymentRepository } from './support/in-memory-payment.repository';

@Module({})
class NoDatabaseModule {}

const VALID_CPF = '52998224725';

const pix = {
  cpf: '529.982.247-25',
  description: 'Mensalidade',
  amount: 149.9,
  paymentMethod: 'PIX',
};

const card = { ...pix, description: 'Compra', paymentMethod: 'CREDIT_CARD' };

describe('Payment (e2e)', () => {
  let app: NestFastifyApplication;
  let repository: InMemoryPaymentRepository;
  let gateway: FakePaymentGateway;

  const http = () => request(app.getHttpServer());

  const providerPaymentIdFor = (paymentId: string): string => {
    const payments = (
      gateway as unknown as {
        payments: Map<string, { externalReference: string }>;
      }
    ).payments;

    for (const [id, payment] of payments) {
      if (payment.externalReference === paymentId) return id;
    }
    throw new Error(`Nenhum pagamento simulado para ${paymentId}`);
  };

  beforeAll(async () => {
    repository = new InMemoryPaymentRepository();
    gateway = new FakePaymentGateway();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(DatabaseModule)
      .useModule(NoDatabaseModule)
      .overrideProvider(PaymentRepositoryContract)
      .useValue(repository)
      .overrideProvider(PaymentGatewayPort)
      .useValue(gateway)
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    configureApp(app, { corsOrigins: ['*'] });

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(() => repository.clear());

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/payment', () => {
    it('deve criar PIX como PENDING, sem checkout e com o CPF sem máscara', async () => {
      const { body } = await http().post('/api/payment').send(pix).expect(201);

      expect(body).toMatchObject({
        cpf: VALID_CPF,
        status: 'PENDING',
        paymentMethod: 'PIX',
        checkoutUrl: null,
      });
    });

    it('deve criar cartão já com a URL do checkout', async () => {
      const { body } = await http().post('/api/payment').send(card).expect(201);

      expect(body.status).toBe('PENDING');
      expect(body.checkoutUrl).toMatch(/^https:\/\/fake-checkout\.local\//);
    });

    it.each([
      [{ ...pix, cpf: '111.111.111-11' }, 'cpf'],
      [{ ...pix, amount: 0 }, 'amount'],
      [{ ...pix, amount: 10.123 }, 'amount'],
      [{ ...pix, paymentMethod: 'BOLETO' }, 'paymentMethod'],
      [{ ...pix, description: '' }, 'description'],
    ])('deve recusar entrada inválida (%j)', async (payload, field) => {
      const { body } = await http()
        .post('/api/payment')
        .send(payload)
        .expect(400);

      expect(body.message.join()).toContain(field);
    });
  });

  describe('GET /api/payment/:id', () => {
    it('deve devolver o pagamento', async () => {
      const created = await http().post('/api/payment').send(pix);

      const { body } = await http()
        .get(`/api/payment/${created.body.id}`)
        .expect(200);

      expect(body.id).toBe(created.body.id);
    });

    it('deve responder 404 para um id inexistente', async () => {
      await http()
        .get('/api/payment/d2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b')
        .expect(404);
    });

    it('deve responder 400 para um id que não é UUID', async () => {
      await http().get('/api/payment/123').expect(400);
    });
  });

  describe('GET /api/payment', () => {
    beforeEach(async () => {
      await http().post('/api/payment').send(pix);
      await http().post('/api/payment').send(pix);
      await http().post('/api/payment').send(card);
    });

    it('deve filtrar por meio de pagamento e CPF', async () => {
      const { body, headers } = await http()
        .get('/api/payment')
        .query({ paymentMethod: 'PIX', cpf: pix.cpf })
        .expect(200);

      expect(body).toHaveLength(2);
      expect(headers['x-total-count']).toBe('2');
    });

    it('deve paginar e informar o total', async () => {
      const { body, headers } = await http()
        .get('/api/payment')
        .query({ page: 2, limit: 2 })
        .expect(200);

      expect(body).toHaveLength(1);
      expect(headers['x-total-count']).toBe('3');
    });

    it('deve recusar filtro inválido', async () => {
      await http().get('/api/payment').query({ limit: 500 }).expect(400);
    });
  });

  describe('PUT /api/payment/:id', () => {
    it('deve atualizar o status de um PIX e travar o estado final', async () => {
      const { body: created } = await http().post('/api/payment').send(pix);

      const { body } = await http()
        .put(`/api/payment/${created.id}`)
        .send({ status: 'PAID' })
        .expect(200);
      expect(body.status).toBe('PAID');

      await http()
        .put(`/api/payment/${created.id}`)
        .send({ status: 'FAIL' })
        .expect(409);
    });

    it('não deve aceitar mudança manual de status em cartão', async () => {
      const { body: created } = await http().post('/api/payment').send(card);

      await http()
        .put(`/api/payment/${created.id}`)
        .send({ status: 'PAID' })
        .expect(409);
    });

    it('deve aceitar mudar a descrição de um cartão', async () => {
      const { body: created } = await http().post('/api/payment').send(card);

      const { body } = await http()
        .put(`/api/payment/${created.id}`)
        .send({ description: 'Compra revisada' })
        .expect(200);

      expect(body.description).toBe('Compra revisada');
      expect(body.status).toBe('PENDING');
    });

    it('deve recusar campos que não podem ser alterados', async () => {
      const { body: created } = await http().post('/api/payment').send(pix);

      await http()
        .put(`/api/payment/${created.id}`)
        .send({ amount: 1 })
        .expect(400);
    });
  });

  describe('POST /api/payment/webhook', () => {
    it('deve marcar o cartão como PAID quando o provedor aprovar', async () => {
      const { body: created } = await http().post('/api/payment').send(card);

      await http()
        .post('/api/payment/webhook')
        .send({
          type: 'payment',
          data: { id: providerPaymentIdFor(created.id) },
        })
        .expect(200, { received: true });

      const { body } = await http().get(`/api/payment/${created.id}`);
      expect(body.status).toBe('PAID');
    });

    it('deve ignorar eventos que não são de pagamento', async () => {
      await http()
        .post('/api/payment/webhook')
        .send({ type: 'merchant_order', data: { id: '1' } })
        .expect(200, { received: true });
    });

    it('deve responder 502 quando o provedor não reconhece o pagamento', async () => {
      await http()
        .post('/api/payment/webhook')
        .send({ type: 'payment', data: { id: 'nao-existe' } })
        .expect(502);
    });
  });
});
