import { ArgumentsHost, HttpStatus } from '@nestjs/common';

import { PaymentGatewayException } from '@application/exceptions/payment-gateway.exception';

import { PaymentGatewayExceptionFilter } from '../payment-gateway-exception.filter';

describe('PaymentGatewayExceptionFilter', () => {
  it('deve responder 502 com a mensagem do gateway', () => {
    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send });
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;

    new PaymentGatewayExceptionFilter().catch(
      new PaymentGatewayException('Mercado Pago fora', 503),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_GATEWAY);
    expect(send).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_GATEWAY,
      error: 'PaymentGatewayException',
      message: 'Mercado Pago fora',
    });
  });
});
