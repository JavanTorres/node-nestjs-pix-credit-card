import { Repository } from 'typeorm';

import { Payment } from '@domain/entities/payment.entity';
import { PaymentMethod, PaymentStatus } from '@domain/enums';
import { ConcurrentPaymentUpdateException } from '@domain/exceptions';

import { PaymentOrmEntity } from '../entities/payment.orm-entity';
import { PaymentRepositoryImpl } from '../payment.repository.impl';

const PAYMENT_ID = 'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b';
const CREATED_AT = new Date('2026-01-01T10:00:00Z');
const UPDATED_AT = new Date('2026-01-02T10:00:00Z');

const buildRow = (
  overrides: Partial<PaymentOrmEntity> = {},
): PaymentOrmEntity =>
  ({
    id: PAYMENT_ID,
    cpf: '52998224725',
    description: 'Mensalidade',
    amount: '149.90',
    paymentMethod: PaymentMethod.PIX,
    status: PaymentStatus.PENDING,
    externalId: null,
    checkoutUrl: null,
    version: 0,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  }) as PaymentOrmEntity;

const buildPayment = (): Payment =>
  new Payment(
    PAYMENT_ID,
    '52998224725',
    'Mensalidade',
    149.9,
    PaymentMethod.PIX,
    PaymentStatus.PENDING,
    CREATED_AT,
    UPDATED_AT,
    null,
  );

describe('mapeamento do checkoutUrl', () => {
  it('deve ir e voltar entre domínio e persistência', async () => {
    const model = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    } as unknown as jest.Mocked<Repository<PaymentOrmEntity>>;

    const repository = new PaymentRepositoryImpl(model);

    const payment = new Payment(
      PAYMENT_ID,
      '52998224725',
      'Mensalidade',
      149.9,
      PaymentMethod.CREDIT_CARD,
      PaymentStatus.PENDING,
      CREATED_AT,
      UPDATED_AT,
      'pref-1',
      'https://mp.com/go',
    );

    const saved = await repository.update(payment);

    expect(model.update.mock.calls[0][1]).toMatchObject({
      checkoutUrl: 'https://mp.com/go',
    });
    expect(saved?.checkoutUrl).toBe('https://mp.com/go');
  });
});

describe('PaymentRepositoryImpl', () => {
  let repository: PaymentRepositoryImpl;
  let model: jest.Mocked<Repository<PaymentOrmEntity>>;

  beforeEach(() => {
    model = {
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      update: jest.fn(),
      existsBy: jest.fn(),
    } as unknown as jest.Mocked<Repository<PaymentOrmEntity>>;

    repository = new PaymentRepositoryImpl(model);
  });

  describe('create', () => {
    it('deve gravar o valor com duas casas decimais', async () => {
      model.save.mockResolvedValue(buildRow());

      await repository.create(buildPayment());

      expect(model.save.mock.calls[0][0]).toMatchObject({
        id: PAYMENT_ID,
        amount: '149.90',
      });
    });

    it('deve preservar o createdAt do domínio', async () => {
      model.save.mockResolvedValue(buildRow());

      await repository.create(buildPayment());

      expect(model.save.mock.calls[0][0]).toMatchObject({
        createdAt: CREATED_AT,
      });
    });

    it('deve converter a linha gravada de volta para o domínio', async () => {
      model.save.mockResolvedValue(buildRow());

      const result = await repository.create(buildPayment());

      expect(result).toBeInstanceOf(Payment);
      expect(result.amount).toBe(149.9);
      expect(result.createdAt).toBe(CREATED_AT);
    });
  });

  describe('findById', () => {
    it('deve devolver o pagamento convertido', async () => {
      model.findOne.mockResolvedValue(buildRow());

      const result = await repository.findById(PAYMENT_ID);

      expect(model.findOne).toHaveBeenCalledWith({ where: { id: PAYMENT_ID } });
      expect(result?.id).toBe(PAYMENT_ID);
      expect(result?.amount).toBe(149.9);
    });

    it('deve devolver null quando não encontrar', async () => {
      model.findOne.mockResolvedValue(null);

      await expect(repository.findById(PAYMENT_ID)).resolves.toBeNull();
    });
  });

  describe('findAll', () => {
    const firstPage = { page: 1, limit: 20 };

    beforeEach(() => {
      model.findAndCount.mockResolvedValue([[buildRow()], 1]);
    });

    it('deve remover a máscara do CPF antes de filtrar', async () => {
      await repository.findAll({ cpf: '529.982.247-25' }, firstPage);

      expect(model.findAndCount.mock.calls[0][0]?.where).toEqual({
        cpf: '52998224725',
      });
    });

    it('deve combinar todos os filtros informados', async () => {
      await repository.findAll(
        {
          cpf: '52998224725',
          paymentMethod: PaymentMethod.PIX,
          status: PaymentStatus.PAID,
        },
        firstPage,
      );

      expect(model.findAndCount.mock.calls[0][0]?.where).toEqual({
        cpf: '52998224725',
        paymentMethod: PaymentMethod.PIX,
        status: PaymentStatus.PAID,
      });
    });

    it('deve consultar sem filtro quando nenhum for informado', async () => {
      await repository.findAll({}, firstPage);

      expect(model.findAndCount.mock.calls[0][0]?.where).toEqual({});
    });

    it('deve ordenar do mais recente para o mais antigo, com desempate estável', async () => {
      await repository.findAll({}, firstPage);

      expect(model.findAndCount.mock.calls[0][0]?.order).toEqual({
        createdAt: 'DESC',
        id: 'DESC',
      });
    });

    it('deve traduzir página e limite em offset', async () => {
      await repository.findAll({}, { page: 3, limit: 10 });

      expect(model.findAndCount.mock.calls[0][0]).toMatchObject({
        skip: 20,
        take: 10,
      });
    });

    it('deve converter as linhas e devolver o total', async () => {
      const result = await repository.findAll({}, firstPage);

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toBeInstanceOf(Payment);
    });
  });

  describe('update', () => {
    it('deve gravar só se a versão não mudou, incrementando-a', async () => {
      model.update.mockResolvedValue({ affected: 1 } as never);

      const result = await repository.update(buildPayment());

      const [criteria, changes] = model.update.mock.calls[0];
      expect(criteria).toEqual({ id: PAYMENT_ID, version: 0 });
      expect(changes).toMatchObject({ version: 1 });
      expect(result?.version).toBe(1);
    });

    it('deve devolver o pagamento como gravado', async () => {
      model.update.mockResolvedValue({ affected: 1 } as never);

      const result = await repository.update(buildPayment());

      expect(result).toBeInstanceOf(Payment);
      expect(result?.amount).toBe(149.9);
      expect(result?.updatedAt).toEqual(UPDATED_AT);
    });

    it('deve devolver null quando o pagamento não existir', async () => {
      model.update.mockResolvedValue({ affected: 0 } as never);
      model.existsBy.mockResolvedValue(false);

      await expect(repository.update(buildPayment())).resolves.toBeNull();
    });

    it('deve acusar conflito quando outra operação gravou antes', async () => {
      model.update.mockResolvedValue({ affected: 0 } as never);
      model.existsBy.mockResolvedValue(true);

      await expect(repository.update(buildPayment())).rejects.toThrow(
        ConcurrentPaymentUpdateException,
      );
    });
  });
});
