import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';

import { CreatePaymentUseCase } from '@application/usecases/payment/create-payment.usecase';
import {
  DEFAULT_PAGINATION,
  FindAllPaymentsUseCase,
} from '@application/usecases/payment/find-all-payments.usecase';
import { FindPaymentByIdUseCase } from '@application/usecases/payment/find-payment-by-id.usecase';
import { ReceivePaymentNotificationUseCase } from '@application/usecases/payment/receive-payment-notification.usecase';
import { UpdatePaymentUseCase } from '@application/usecases/payment/update-payment.usecase';
import { PaymentMethod, PaymentStatus } from '@domain/enums';
import { CreatePaymentRequestDto } from '@presentation/dto/payment/create-payment-request.dto';
import { FindPaymentsQueryDto } from '@presentation/dto/payment/find-payments-query.dto';
import { MercadoPagoWebhookDto } from '@presentation/dto/payment/mercado-pago-webhook.dto';
import { PaymentResponseDto } from '@presentation/dto/payment/payment-response.dto';
import { UpdatePaymentRequestDto } from '@presentation/dto/payment/update-payment-request.dto';
import { MercadoPagoSignatureGuard } from '@presentation/guards/mercado-pago-signature.guard';
import { PaymentMapper } from '@presentation/mappers/payment.mapper';

@Controller({
  path: 'payment',
  version: [VERSION_NEUTRAL, '1'],
})
@ApiTags('Payment')
export class PaymentController {
  constructor(
    private readonly createPayment: CreatePaymentUseCase,
    private readonly findPaymentById: FindPaymentByIdUseCase,
    private readonly findAllPayments: FindAllPaymentsUseCase,
    private readonly updatePayment: UpdatePaymentUseCase,
    private readonly receivePaymentNotification: ReceivePaymentNotificationUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cria um novo pagamento' })
  @ApiCreatedResponse({
    description: 'Pagamento criado com sucesso',
    type: PaymentResponseDto,
  })
  @ApiAcceptedResponse({
    description:
      'Cartão com Temporal: a cobrança foi aceita, mas a preferência ainda ' +
      'está sendo criada. Consulte GET /api/payment/{id} para obter o ' +
      'checkoutUrl.',
    type: PaymentResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Dados inválidos' })
  async create(
    @Body() createPaymentRequestDto: CreatePaymentRequestDto,
    @Res({ passthrough: true }) reply?: FastifyReply,
  ): Promise<PaymentResponseDto> {
    const payment = await this.createPayment.execute(createPaymentRequestDto);

    const stillProcessing =
      payment.paymentMethod === PaymentMethod.CREDIT_CARD &&
      payment.status === PaymentStatus.PENDING &&
      !payment.checkoutUrl;

    if (stillProcessing) reply?.status(HttpStatus.ACCEPTED);

    return PaymentMapper.toResponse(payment);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lista pagamentos por CPF, meio de pagamento ou status',
  })
  @ApiOkResponse({
    description: 'Página de pagamentos, do mais recente para o mais antigo',
    type: PaymentResponseDto,
    isArray: true,
    headers: {
      'X-Total-Count': {
        description: 'Total de pagamentos que atendem aos filtros',
        schema: { type: 'integer' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Filtros inválidos' })
  async findAll(
    @Query() query: FindPaymentsQueryDto,
    @Res({ passthrough: true }) reply?: FastifyReply,
  ): Promise<PaymentResponseDto[]> {
    const {
      page = DEFAULT_PAGINATION.page,
      limit = DEFAULT_PAGINATION.limit,
      ...filters
    } = query;

    const result = await this.findAllPayments.execute(filters, {
      page,
      limit,
    });

    reply?.header('X-Total-Count', String(result.total));

    return result.items.map(PaymentMapper.toResponse);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @UseGuards(MercadoPagoSignatureGuard)
  @ApiOperation({
    summary: 'Recebe a notificação de pagamento do Mercado Pago',
    description:
      'Endpoint configurado como notification_url na preferência de ' +
      'checkout. Responde 200 mesmo para eventos ignorados, para que o ' +
      'Mercado Pago não reenvie a notificação indefinidamente.',
  })
  @ApiOkResponse({ description: 'Notificação recebida' })
  @ApiUnauthorizedResponse({ description: 'Assinatura x-signature inválida' })
  async handleWebhook(
    @Body() body: MercadoPagoWebhookDto,
    @Query('data.id') queryDataId?: string,
  ): Promise<{ received: true }> {
    const providerPaymentId = MercadoPagoWebhookDto.resolvePaymentId(
      body,
      queryDataId,
    );

    if (providerPaymentId) {
      await this.receivePaymentNotification.execute(providerPaymentId);
    }

    return { received: true };
  }

  @Get('checkout/return')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recebe o cliente de volta do Checkout Pro',
    description:
      'Alvo das back_urls da preferência. Serve apenas para fechar o ciclo ' +
      'de navegação: quem atualiza o status é o webhook, porque esta rota ' +
      'depende do navegador do cliente e pode nunca ser chamada.',
  })
  @ApiOkResponse({ description: 'Retorno do checkout' })
  checkoutReturn(@Query() query: Record<string, string>): {
    outcome: string;
    paymentId: string | null;
    detailsUrl: string | null;
  } {
    const paymentId = query.external_reference ?? null;

    return {
      outcome: query.outcome ?? query.status ?? 'unknown',
      paymentId,
      detailsUrl: paymentId ? `/api/payment/${paymentId}` : null,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retorna os detalhes de um pagamento' })
  @ApiParam({ name: 'id', description: 'UUID do pagamento', format: 'uuid' })
  @ApiOkResponse({
    description: 'Pagamento encontrado',
    type: PaymentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Pagamento não encontrado' })
  @ApiBadRequestResponse({ description: 'UUID inválido' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.findPaymentById.execute(id);
    return PaymentMapper.toResponse(payment);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Atualiza os dados de um pagamento existente',
    description:
      'Atualização parcial: só os campos enviados mudam. O status de ' +
      'CREDIT_CARD não aceita mudança manual — quem o decide é a ' +
      'confirmação do Mercado Pago (webhook ou reconciliação).',
  })
  @ApiParam({ name: 'id', description: 'UUID do pagamento', format: 'uuid' })
  @ApiOkResponse({
    description: 'Pagamento atualizado com sucesso',
    type: PaymentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Pagamento não encontrado' })
  @ApiConflictResponse({
    description:
      'Transição de status inválida, status de cartão alterado manualmente ' +
      'ou pagamento alterado por outra operação no mesmo instante',
  })
  @ApiBadRequestResponse({ description: 'Dados inválidos' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePaymentRequestDto: UpdatePaymentRequestDto,
  ): Promise<PaymentResponseDto> {
    const payment = await this.updatePayment.execute(
      id,
      updatePaymentRequestDto,
    );
    return PaymentMapper.toResponse(payment);
  }
}
