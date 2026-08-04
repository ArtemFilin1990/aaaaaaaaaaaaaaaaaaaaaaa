import type { CommercialRequestInput } from "@/lib/request/schema";

export type RequestSubmissionResult = {
  requestId: string;
  mode: "mock";
  acceptedAt: string;
};

export interface CommercialRequestAdapter {
  submit(payload: CommercialRequestInput): Promise<RequestSubmissionResult>;
}

export class MockCommercialRequestAdapter implements CommercialRequestAdapter {
  async submit(payload: CommercialRequestInput): Promise<RequestSubmissionResult> {
    return {
      requestId: `MOCK-${payload.idempotencyKey.slice(0, 8).toUpperCase()}`,
      mode: "mock",
      acceptedAt: new Date().toISOString()
    };
  }
}

export function getCommercialRequestAdapter(): CommercialRequestAdapter {
  const mode = process.env.B24_MODE ?? "mock";
  const writeEnabled = process.env.B24_WRITE_ENABLED === "true";

  if (mode === "mock" && !writeEnabled) {
    return new MockCommercialRequestAdapter();
  }

  throw new Error("Реальная запись Bitrix24 не реализована и заблокирована на текущем этапе.");
}
