import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

import { isValidCpf } from '@domain/validation/cpf';

export function IsCpf(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isCpf',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown): boolean =>
          typeof value === 'string' && isValidCpf(value),
        defaultMessage: (args: ValidationArguments): string =>
          `${args.property} deve ser um CPF válido`,
      },
    });
  };
}
