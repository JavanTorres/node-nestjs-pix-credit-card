import { PaymentMethod } from '@domain/enums';

import { ConflictDomainException } from './domain.exception';

export class ManualStatusChangeNotAllowedException extends ConflictDomainException {
  constructor(
    public readonly paymentId: string,
    public readonly paymentMethod: PaymentMethod,
  ) {
    super(
      `O status do pagamento ${paymentId} (${paymentMethod}) só pode ser ` +
        'alterado pela confirmação do provedor de pagamento.',
    );
  }
}
