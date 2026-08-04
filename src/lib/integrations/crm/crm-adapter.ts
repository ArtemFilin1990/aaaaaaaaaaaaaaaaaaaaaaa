import type { CommercialRequestInput } from "@/lib/request/schema";

export type CrmSubmissionResult = {
  status: "DISABLED";
  submitted: false;
};

export interface CrmAdapter {
  isEnabled(): boolean;
  submitRequest(payload: CommercialRequestInput): Promise<CrmSubmissionResult>;
}

export class DisabledCrmAdapter implements CrmAdapter {
  isEnabled(): boolean {
    return false;
  }

  async submitRequest(_payload: CommercialRequestInput): Promise<CrmSubmissionResult> {
    return { status: "DISABLED", submitted: false };
  }
}

export function getCrmAdapter(): CrmAdapter {
  const mode = process.env.CRM_MODE ?? "disabled";
  if (mode !== "disabled") {
    throw new Error(`Unsupported CRM_MODE: ${mode}`);
  }
  return new DisabledCrmAdapter();
}
