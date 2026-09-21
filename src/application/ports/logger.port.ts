export abstract class LoggerPort {
  abstract log(message: string): void;
  abstract warn(message: string): void;
}
