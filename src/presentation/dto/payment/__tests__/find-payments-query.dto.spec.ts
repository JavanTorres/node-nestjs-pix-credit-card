import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { PaymentMethod, PaymentStatus } from '@domain/enums';

import { FindPaymentsQueryDto } from '../find-payments-query.dto';

const check = (payload: Record<string, unknown>) =>
  validate(plainToInstance(FindPaymentsQueryDto, payload));

describe('FindPaymentsQueryDto', () => {
  it('deve aceitar query vazia', async () => {
    await expect(check({})).resolves.toHaveLength(0);
  });

  it('deve remover a máscara do CPF na transformação', () => {
    const dto = plainToInstance(FindPaymentsQueryDto, {
      cpf: '529.982.247-25',
    });

    expect(dto.cpf).toBe('52998224725');
  });

  it('deve recusar CPF inválido no filtro', async () => {
    const errors = await check({ cpf: '11111111111' });

    expect(errors.map((error) => error.property)).toContain('cpf');
  });

  it('deve aceitar filtro por meio de pagamento', async () => {
    await expect(
      check({ paymentMethod: PaymentMethod.CREDIT_CARD }),
    ).resolves.toHaveLength(0);
  });

  it('deve aceitar filtro por status', async () => {
    await expect(check({ status: PaymentStatus.PAID })).resolves.toHaveLength(
      0,
    );
  });

  it('deve recusar meio de pagamento desconhecido', async () => {
    const errors = await check({ paymentMethod: 'BOLETO' });

    expect(errors.map((error) => error.property)).toContain('paymentMethod');
  });

  it('deve converter page e limit da query string para número', () => {
    const dto = plainToInstance(FindPaymentsQueryDto, {
      page: '2',
      limit: '50',
    });

    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
  });

  it.each([
    [{ page: '0' }, 'page'],
    [{ limit: '0' }, 'limit'],
    [{ limit: '101' }, 'limit'],
    [{ page: '1.5' }, 'page'],
  ])('deve recusar paginação inválida %j', async (payload, property) => {
    const errors = await check(payload);

    expect(errors.map((error) => error.property)).toContain(property);
  });
});
