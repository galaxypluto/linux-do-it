export interface TelemetryPort {
  info(event: string, attributes?: Record<string, unknown>): void;
  warn(event: string, attributes?: Record<string, unknown>): void;
  error(event: string, attributes?: Record<string, unknown>): void;
}

