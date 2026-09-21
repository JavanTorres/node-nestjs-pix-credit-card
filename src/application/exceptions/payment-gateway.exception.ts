export class PaymentGatewayException extends Error {
  constructor(
    message: string,
    public readonly providerStatus: number | null = null,
  ) {
    super(message);
    this.name = new.target.name;
  }

  get retryable(): boolean {
    const status = this.providerStatus;

    return status === null || status >= 500 || status === 408 || status === 429;
  }
}
