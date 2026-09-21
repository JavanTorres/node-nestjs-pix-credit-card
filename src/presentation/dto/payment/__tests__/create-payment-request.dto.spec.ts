import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { MAX_DESCRIPTION_LENGTH } from '@domain/constants';
import { PaymentMethod } from '@domain/enums';

import { CreatePaymentRequestDto } from '../create-payment-request.dto';

const valid = () => ({
  cpf: '52998224725',
  description: 'Mensalidade de outubro',
  amount: 149.9,
  paymentMethod: PaymentMethod.PIX,
});

const check = (payload: Record<string, unknown>) =>
  validate(plainToInstance(CreatePaymentRequestDto, payload));

const errorsOn = async (payload: Record<string, unknown>) =>
  (await check(payload)).map((error) => error.property);

describe('CreatePaymentRequestDto', () => {
  it('deve aceitar um payload válido', async () => {
    await expect(check(valid())).resolves.toHaveLength(0);
  });

  describe('cpf', () => {
    it('deve remover a máscara na transformação', () => {
      const dto = plainToInstance(CreatePaymentRequestDto, {
        ...valid(),
        cpf: '529.982.247-25',
      });

      expect(dto.cpf).toBe('52998224725');
    });

    it('deve recusar CPF inválido', async () => {
      await expect(
        errorsOn({ ...valid(), cpf: '11111111111' }),
      ).resolves.toContain('cpf');
    });

    it('deve recusar CPF ausente', async () => {
      const { cpf, ...withoutCpf } = valid();
      void cpf;

      await expect(errorsOn(withoutCpf)).resolves.toContain('cpf');
    });
  });

  describe('amount', () => {
    it('deve recusar valor abaixo do mínimo', async () => {
      await expect(errorsOn({ ...valid(), amount: 0 })).resolves.toContain(
        'amount',
      );
    });

    it('deve recusar valor acima do máximo', async () => {
      await expect(
        errorsOn({ ...valid(), amount: 1_000_001 }),
      ).resolves.toContain('amount');
    });

    it('deve recusar mais de duas casas decimais', async () => {
      await expect(errorsOn({ ...valid(), amount: 10.999 })).resolves.toContain(
        'amount',
      );
    });

    it('deve recusar valor não numérico', async () => {
      await expect(errorsOn({ ...valid(), amount: 'dez' })).resolves.toContain(
        'amount',
      );
    });
  });

  describe('description', () => {
    it('deve recusar descrição vazia', async () => {
      await expect(
        errorsOn({ ...valid(), description: '' }),
      ).resolves.toContain('description');
    });

    it('deve recusar descrição longa demais', async () => {
      await expect(
        errorsOn({
          ...valid(),
          description: 'a'.repeat(MAX_DESCRIPTION_LENGTH + 1),
        }),
      ).resolves.toContain('description');
    });
  });

  describe('paymentMethod', () => {
    it.each([PaymentMethod.PIX, PaymentMethod.CREDIT_CARD])(
      'deve aceitar %s',
      async (paymentMethod) => {
        await expect(
          check({ ...valid(), paymentMethod }),
        ).resolves.toHaveLength(0);
      },
    );

    it('deve recusar meio de pagamento desconhecido', async () => {
      await expect(
        errorsOn({ ...valid(), paymentMethod: 'BOLETO' }),
      ).resolves.toContain('paymentMethod');
    });
  });
});
