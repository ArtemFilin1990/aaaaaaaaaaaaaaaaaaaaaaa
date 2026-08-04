import { NextResponse } from "next/server";
import { getCrmAdapter } from "@/lib/integrations/crm/crm-adapter";
import { commercialRequestSchema } from "@/lib/request/schema";

const acceptedRequests = new Map<string, { requestId: string; acceptedAt: string }>();

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ ok: false, error: "Ожидается application/json" }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = commercialRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Проверьте обязательные поля",
        fields: parsed.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  const previous = acceptedRequests.get(parsed.data.idempotencyKey);
  if (previous) {
    return NextResponse.json({ ok: true, duplicate: true, integrationStatus: "DISABLED", ...previous });
  }

  try {
    const requestId = `EV-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${parsed.data.idempotencyKey.slice(0, 6).toUpperCase()}`;
    const acceptedAt = new Date().toISOString();
    const crm = getCrmAdapter();
    const crmResult = await crm.submitRequest(parsed.data);

    acceptedRequests.set(parsed.data.idempotencyKey, { requestId, acceptedAt });

    return NextResponse.json(
      {
        ok: true,
        duplicate: false,
        requestId,
        acceptedAt,
        integrationStatus: crmResult.status
      },
      { status: 202 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Не удалось сохранить заявку. Повторите попытку позже." },
      { status: 503 }
    );
  }
}
