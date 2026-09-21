import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { MAX_DESCRIPTION_LENGTH } from '@domain/constants';
import { PaymentStatus } from '@domain/enums';

import { UpdatePaymentRequestDto } from '../update-payment-request.dto';

const check = (payload: Record<string, unknown>) =>
  validate(plainToInstance(UpdatePaymentRequestDto, payload));

describe('UpdatePaymentRequestDto', () => {
  it('deve aceitar payload vazio, já que todos os campos são opcionais', async () => {
    await expect(check({})).resolves.toHaveLength(0);
  });

  it.each([PaymentStatus.PENDING, PaymentStatus.PAID, PaymentStatus.FAIL])(
    'deve aceitar o status %s',
    async (status) => {
      await expect(check({ status })).resolves.toHaveLength(0);
    },
  );

  it('deve recusar status desconhecido', async () => {
    const errors = await check({ status: 'CANCELED' });

    expect(errors.map((error) => error.property)).toContain('status');
  });

  it('deve aceitar apenas a descrição', async () => {
    await expect(
      check({ description: 'Nova descrição' }),
    ).resolves.toHaveLength(0);
  });

  it('deve recusar descrição longa demais', async () => {
    const errors = await check({
      description: 'a'.repeat(MAX_DESCRIPTION_LENGTH + 1),
    });

    expect(errors.map((error) => error.property)).toContain('description');
  });
});
