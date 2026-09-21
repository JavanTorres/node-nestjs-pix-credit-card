export abstract class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Error.captureStackTrace?.(this, new.target);
  }
}

export abstract class InvalidInputException extends DomainException {}

export abstract class NotFoundDomainException extends DomainException {}

export abstract class ConflictDomainException extends DomainException {}
