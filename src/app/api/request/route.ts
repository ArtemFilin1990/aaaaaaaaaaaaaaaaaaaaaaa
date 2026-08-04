import { NextResponse } from "next/server";
import { getCommercialRequestAdapter } from "@/lib/integrations/bitrix24/request-adapter";
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
    return NextResponse.json({ ok: true, duplicate: true, mode: "mock", ...previous });
  }

  try {
    const adapter = getCommercialRequestAdapter();
    const result = await adapter.submit(parsed.data);
    acceptedRequests.set(parsed.data.idempotencyKey, {
      requestId: result.requestId,
      acceptedAt: result.acceptedAt
    });
    return NextResponse.json({ ok: true, duplicate: false, ...result }, { status: 202 });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Отправка отключена: доступен только безопасный mock-режим." },
      { status: 503 }
    );
  }
}
