import { CreatePaymentUseCase } from '@application/usecases/payment/create-payment.usecase';
import { FindAllPaymentsUseCase } from '@application/usecases/payment/find-all-payments.usecase';
import { FindPaymentByIdUseCase } from '@application/usecases/payment/find-payment-by-id.usecase';
import { ReceivePaymentNotificationUseCase } from '@application/usecases/payment/receive-payment-notification.usecase';
import { UpdatePaymentUseCase } from '@application/usecases/payment/update-payment.usecase';
import { Payment } from '@domain/entities/payment.entity';
import { PaymentMethod, PaymentStatus } from '@domain/enums';

import { PaymentController } from '../payment.controller';

const PAYMENT_ID = 'd2f3a1b4-5c6d-4e7f-8a9b-0c1d2e3f4a5b';

const buildPayment = (): Payment =>
  Payment.create(
    PAYMENT_ID,
    '52998224725',
    'Mensalidade',
    149.9,
    PaymentMethod.PIX,
  );

describe('PaymentController', () => {
  let controller: PaymentController;
  let create: jest.Mocked<CreatePaymentUseCase>;
  let findById: jest.Mocked<FindPaymentByIdUseCase>;
  let findAll: jest.Mocked<FindAllPaymentsUseCase>;
  let update: jest.Mocked<UpdatePaymentUseCase>;
  let receiveNotification: jest.Mocked<ReceivePaymentNotificationUseCase>;

  const mockUseCase = <T>() => ({ execute: jest.fn() }) as unknown as T;

  beforeEach(() => {
    create = mockUseCase();
    findById = mockUseCase();
    findAll = mockUseCase();
    update = mockUseCase();
    receiveNotification = mockUseCase();

    controller = new PaymentController(
      create,
      findById,
      findAll,
      update,
      receiveNotification,
    );
  });

  describe('create', () => {
    it('deve repassar o DTO ao caso de uso', async () => {
      create.execute.mockResolvedValue(buildPayment());

      const dto = {
        cpf: '52998224725',
        description: 'Mensalidade',
        amount: 149.9,
        paymentMethod: PaymentMethod.PIX,
      };

      await controller.create(dto);

      expect(create.execute).toHaveBeenCalledWith(dto);
    });

    it('deve devolver a resposta mapeada', async () => {
      create.execute.mockResolvedValue(buildPayment());

      const result = await controller.create({
        cpf: '52998224725',
        description: 'Mensalidade',
        amount: 149.9,
        paymentMethod: PaymentMethod.PIX,
      });

      expect(result.id).toBe(PAYMENT_ID);
      expect(result.status).toBe(PaymentStatus.PENDING);
    });

    describe('status HTTP', () => {
      const cardDto = {
        cpf: '52998224725',
        description: 'Compra',
        amount: 99.9,
        paymentMethod: PaymentMethod.CREDIT_CARD,
      };
      const card = () =>
        Payment.create(
          PAYMENT_ID,
          '52998224725',
          'Compra',
          99.9,
          PaymentMethod.CREDIT_CARD,
        );

      let reply: { status: jest.Mock };

      beforeEach(() => {
        reply = { status: jest.fn() };
      });

      it('deve responder 202 quando o cartão ainda não tem checkout', async () => {
        create.execute.mockResolvedValue(card());

        await controller.create(cardDto, reply as never);

        expect(reply.status).toHaveBeenCalledWith(202);
      });

      it('deve manter o 201 quando o checkout já veio', async () => {
        create.execute.mockResolvedValue(
          card().withCheckout('pref-1', 'https://mp.com/1'),
        );

        await controller.create(cardDto, reply as never);

        expect(reply.status).not.toHaveBeenCalled();
      });

      it('deve manter o 201 para PIX, que nunca tem checkout', async () => {
        create.execute.mockResolvedValue(buildPayment());

        await controller.create(
          { ...cardDto, paymentMethod: PaymentMethod.PIX },
          reply as never,
        );

        expect(reply.status).not.toHaveBeenCalled();
      });
    });
  });

  describe('findAll', () => {
    it('deve separar filtros e paginação, com a paginação padrão', async () => {
      findAll.execute.mockResolvedValue({ items: [], total: 0 });

      await controller.findAll({ paymentMethod: PaymentMethod.PIX });

      expect(findAll.execute).toHaveBeenCalledWith(
        { paymentMethod: PaymentMethod.PIX },
        { page: 1, limit: 20 },
      );
    });

    it('deve repassar a página pedida', async () => {
      findAll.execute.mockResolvedValue({ items: [], total: 0 });

      await controller.findAll({ page: 3, limit: 5 });

      expect(findAll.execute).toHaveBeenCalledWith({}, { page: 3, limit: 5 });
    });

    it('deve mapear cada item e expor o total no cabeçalho', async () => {
      findAll.execute.mockResolvedValue({
        items: [buildPayment(), buildPayment()],
        total: 42,
      });
      const reply = { header: jest.fn() };

      const result = await controller.findAll({}, reply as never);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(PAYMENT_ID);
      expect(reply.header).toHaveBeenCalledWith('X-Total-Count', '42');
    });
  });

  describe('findById', () => {
    it('deve repassar o id e mapear a resposta', async () => {
      findById.execute.mockResolvedValue(buildPayment());

      const result = await controller.findById(PAYMENT_ID);

      expect(findById.execute).toHaveBeenCalledWith(PAYMENT_ID);
      expect(result.id).toBe(PAYMENT_ID);
    });
  });

  describe('update', () => {
    it('deve repassar id e DTO ao caso de uso', async () => {
      update.execute.mockResolvedValue(buildPayment());

      await controller.update(PAYMENT_ID, { status: PaymentStatus.PAID });

      expect(update.execute).toHaveBeenCalledWith(PAYMENT_ID, {
        status: PaymentStatus.PAID,
      });
    });
  });

  describe('handleWebhook', () => {
    it('deve extrair o id do corpo e repassar só ele ao caso de uso', async () => {
      receiveNotification.execute.mockResolvedValue();

      await controller.handleWebhook({
        type: 'payment',
        data: { id: '12345' },
      });

      expect(receiveNotification.execute).toHaveBeenCalledWith('12345');
    });

    it('deve aceitar o id vindo pela query string', async () => {
      receiveNotification.execute.mockResolvedValue();

      await controller.handleWebhook({ type: 'payment' }, '67890');

      expect(receiveNotification.execute).toHaveBeenCalledWith('67890');
    });

    it('não deve chamar o caso de uso em evento que não é de pagamento', async () => {
      await controller.handleWebhook({
        type: 'merchant_order',
        data: { id: '1' },
      });

      expect(receiveNotification.execute).not.toHaveBeenCalled();
    });

    it('não deve chamar o caso de uso quando não há id', async () => {
      await controller.handleWebhook({});

      expect(receiveNotification.execute).not.toHaveBeenCalled();
    });

    it('deve confirmar o recebimento mesmo quando ignora o evento', async () => {
      await expect(
        controller.handleWebhook({ type: 'merchant_order' }),
      ).resolves.toEqual({ received: true });
    });
  });

  describe('checkoutReturn', () => {
    it('deve apontar para o pagamento usando o external_reference', () => {
      expect(
        controller.checkoutReturn({
          outcome: 'success',
          external_reference: 'abc-123',
          payment_id: '999',
        }),
      ).toEqual({
        outcome: 'success',
        paymentId: 'abc-123',
        detailsUrl: '/api/payment/abc-123',
      });
    });

    it('deve cair no status quando o outcome não vem', () => {
      expect(controller.checkoutReturn({ status: 'approved' }).outcome).toBe(
        'approved',
      );
    });

    it('deve tolerar um retorno sem parâmetro nenhum', () => {
      expect(controller.checkoutReturn({})).toEqual({
        outcome: 'unknown',
        paymentId: null,
        detailsUrl: null,
      });
    });

    it('não deve tocar no pagamento: quem decide o status é o webhook', () => {
      controller.checkoutReturn({ external_reference: 'abc-123' });

      expect(update.execute).not.toHaveBeenCalled();
      expect(receiveNotification.execute).not.toHaveBeenCalled();
    });
  });
});
