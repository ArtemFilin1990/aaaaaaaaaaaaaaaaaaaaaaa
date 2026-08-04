"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { commercialRequestSchema, type RequestItemInput } from "@/lib/request/schema";

const STORAGE_KEY = "everest-commercial-request-v1";

type DraftState = {
  idempotencyKey: string;
  companyName: string;
  inn: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  requiredDate: string;
  contactMethod: "phone" | "email" | "messenger";
  paymentTerms: string;
  comment: string;
  consent: boolean;
  items: RequestItemInput[];
};

type SubmissionState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; requestId: string; duplicate: boolean }
  | { status: "error"; message: string; fields?: Record<string, string[]> };

const emptyItem = (): RequestItemInput => ({
  productSlug: `manual-${Date.now()}`,
  designation: "",
  quantity: 1,
  unit: "шт",
  requiredDate: "",
  analogAllowed: false,
  comment: ""
});

const emptyDraft = (): DraftState => ({
  idempotencyKey: "",
  companyName: "",
  inn: "",
  contactName: "",
  phone: "",
  email: "",
  city: "",
  requiredDate: "",
  contactMethod: "email",
  paymentTerms: "",
  comment: "",
  consent: false,
  items: []
});

function mergeInitialItem(items: RequestItemInput[], initialItem?: RequestItemInput): RequestItemInput[] {
  if (!initialItem || items.some((item) => item.productSlug === initialItem.productSlug)) return items;
  return [...items, initialItem];
}

export function RequestCartForm({ initialItem }: { initialItem?: RequestItemInput }) {
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [hydrated, setHydrated] = useState(false);
  const [submission, setSubmission] = useState<SubmissionState>({ status: "idle" });

  useEffect(() => {
    let next = emptyDraft();
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) next = { ...next, ...(JSON.parse(stored) as Partial<DraftState>) };
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    next.idempotencyKey ||= window.crypto.randomUUID();
    next.items = mergeInitialItem(Array.isArray(next.items) ? next.items : [], initialItem);
    setDraft(next);
    setHydrated(true);
  }, [initialItem]);

  useEffect(() => {
    if (!hydrated || submission.status === "success") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft, hydrated, submission.status]);

  const totalPositions = useMemo(() => draft.items.length, [draft.items.length]);

  function updateItem(index: number, changes: Partial<RequestItemInput>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item)
    }));
  }

  function removeItem(index: number) {
    setDraft((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
  }

  function addManualItem() {
    setDraft((current) => ({ ...current, items: [...current.items, emptyItem()] }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmission({ status: "submitting" });

    const payload = {
      ...draft,
      sourcePath: window.location.pathname + window.location.search
    };
    const parsed = commercialRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setSubmission({
        status: "error",
        message: "Проверьте обязательные поля и позиции заявки.",
        fields: parsed.error.flatten().fieldErrors as Record<string, string[]>
      });
      return;
    }

    try {
      const response = await fetch("/api/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data)
      });
      const result = await response.json() as {
        ok?: boolean;
        error?: string;
        requestId?: string;
        duplicate?: boolean;
        fields?: Record<string, string[]>;
      };
      if (!response.ok || !result.ok || !result.requestId) {
        setSubmission({ status: "error", message: result.error ?? "Заявка не отправлена.", fields: result.fields });
        return;
      }

      window.localStorage.removeItem(STORAGE_KEY);
      setDraft({ ...emptyDraft(), idempotencyKey: window.crypto.randomUUID() });
      setSubmission({ status: "success", requestId: result.requestId, duplicate: Boolean(result.duplicate) });
    } catch {
      setSubmission({ status: "error", message: "Не удалось связаться с сервером. Черновик сохранён в браузере." });
    }
  }

  if (!hydrated) {
    return <div className="mt-10 rounded-xl border border-steel bg-white p-8">Загрузка черновика заявки…</div>;
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-8">
      <section className="rounded-xl border border-steel bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Позиции заявки</h2>
            <p className="mt-1 text-sm text-neutral-600">Позиций: {totalPositions}. Цены и наличие подтверждаются менеджером.</p>
          </div>
          <button type="button" onClick={addManualItem} className="rounded-md border border-steel px-4 py-2 font-semibold">Добавить позицию</button>
        </div>

        {draft.items.length ? (
          <div className="mt-6 space-y-5">
            {draft.items.map((item, index) => (
              <article key={`${item.productSlug}-${index}`} className="rounded-lg border border-steel p-5">
                <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
                  <label className="grid gap-2 text-sm font-semibold">Обозначение
                    <input value={item.designation} onChange={(event) => updateItem(index, { designation: event.target.value })} required className="min-h-11 rounded-md border border-steel px-3 font-mono font-normal" />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold">Количество
                    <input value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} type="number" min="0.001" step="any" required className="min-h-11 rounded-md border border-steel px-3 font-normal" />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold">Единица
                    <select value={item.unit} onChange={(event) => updateItem(index, { unit: event.target.value as RequestItemInput["unit"] })} className="min-h-11 rounded-md border border-steel px-3 font-normal">
                      <option value="шт">шт</option><option value="компл">компл</option><option value="кг">кг</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-semibold">Требуемый срок
                    <input value={item.requiredDate} onChange={(event) => updateItem(index, { requiredDate: event.target.value })} type="date" className="min-h-11 rounded-md border border-steel px-3 font-normal" />
                  </label>
                  <label className="flex items-center gap-3 self-end text-sm font-semibold">
                    <input checked={item.analogAllowed} onChange={(event) => updateItem(index, { analogAllowed: event.target.checked })} type="checkbox" className="h-5 w-5" />
                    Допустим проверенный аналог
                  </label>
                  <button type="button" onClick={() => removeItem(index)} className="self-end justify-self-start rounded-md border border-steel px-4 py-2 text-sm font-semibold">Удалить</button>
                </div>
                <label className="mt-4 grid gap-2 text-sm font-semibold">Комментарий по позиции
                  <textarea value={item.comment} onChange={(event) => updateItem(index, { comment: event.target.value })} className="min-h-20 rounded-md border border-steel p-3 font-normal" placeholder="Бренд, исполнение, условия эксплуатации" />
                </label>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-lg bg-warm-white p-5 text-sm">Добавьте хотя бы одну позицию или вернитесь в каталог.</div>
        )}
      </section>

      <section className="grid gap-5 rounded-xl border border-steel bg-white p-6 md:grid-cols-2">
        <h2 className="text-2xl font-bold md:col-span-2">Данные компании</h2>
        <label className="grid gap-2 text-sm font-semibold">Компания
          <input value={draft.companyName} onChange={(event) => setDraft({ ...draft, companyName: event.target.value })} required className="min-h-11 rounded-md border border-steel px-3 font-normal" />
        </label>
        <label className="grid gap-2 text-sm font-semibold">ИНН
          <input value={draft.inn} onChange={(event) => setDraft({ ...draft, inn: event.target.value.replace(/\D/g, "") })} inputMode="numeric" required className="min-h-11 rounded-md border border-steel px-3 font-normal" />
        </label>
        <label className="grid gap-2 text-sm font-semibold">Контактное лицо
          <input value={draft.contactName} onChange={(event) => setDraft({ ...draft, contactName: event.target.value })} required className="min-h-11 rounded-md border border-steel px-3 font-normal" />
        </label>
        <label className="grid gap-2 text-sm font-semibold">Город поставки
          <input value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} required className="min-h-11 rounded-md border border-steel px-3 font-normal" />
        </label>
        <label className="grid gap-2 text-sm font-semibold">Телефон
          <input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} type="tel" required className="min-h-11 rounded-md border border-steel px-3 font-normal" />
        </label>
        <label className="grid gap-2 text-sm font-semibold">E-mail
          <input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} type="email" required className="min-h-11 rounded-md border border-steel px-3 font-normal" />
        </label>
        <label className="grid gap-2 text-sm font-semibold">Общий требуемый срок
          <input value={draft.requiredDate} onChange={(event) => setDraft({ ...draft, requiredDate: event.target.value })} type="date" className="min-h-11 rounded-md border border-steel px-3 font-normal" />
        </label>
        <label className="grid gap-2 text-sm font-semibold">Предпочтительный способ связи
          <select value={draft.contactMethod} onChange={(event) => setDraft({ ...draft, contactMethod: event.target.value as DraftState["contactMethod"] })} className="min-h-11 rounded-md border border-steel px-3 font-normal">
            <option value="email">E-mail</option><option value="phone">Телефон</option><option value="messenger">Мессенджер</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold md:col-span-2">Условия оплаты
          <input value={draft.paymentTerms} onChange={(event) => setDraft({ ...draft, paymentTerms: event.target.value })} className="min-h-11 rounded-md border border-steel px-3 font-normal" placeholder="Например: безналичная оплата, отсрочка — на согласование" />
        </label>
        <label className="grid gap-2 text-sm font-semibold md:col-span-2">Общий комментарий
          <textarea value={draft.comment} onChange={(event) => setDraft({ ...draft, comment: event.target.value })} className="min-h-28 rounded-md border border-steel p-3 font-normal" />
        </label>
        <label className="flex items-start gap-3 text-sm md:col-span-2">
          <input checked={draft.consent} onChange={(event) => setDraft({ ...draft, consent: event.target.checked })} type="checkbox" required className="mt-0.5 h-5 w-5" />
          <span>Согласен на обработку данных для подготовки ответа на заявку. Текст политики требует юридической проверки перед production-публикацией.</span>
        </label>
      </section>

      {submission.status === "error" ? (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-5 text-sm">
          <p className="font-semibold">{submission.message}</p>
          {submission.fields ? <ul className="mt-2 list-disc pl-5">{Object.entries(submission.fields).flatMap(([field, messages]) => messages.map((message) => <li key={`${field}-${message}`}>{field}: {message}</li>))}</ul> : null}
        </div>
      ) : null}

      {submission.status === "success" ? (
        <div role="status" className="rounded-xl border border-steel bg-white p-6">
          <h2 className="text-xl font-bold">Заявка принята в безопасном mock-режиме</h2>
          <p className="mt-2 font-mono">Номер: {submission.requestId}</p>
          <p className="mt-2 text-sm text-neutral-600">Реальная запись в Bitrix24 не выполнялась.{submission.duplicate ? " Сервер распознал повторную отправку." : ""}</p>
        </div>
      ) : null}

      <button disabled={submission.status === "submitting" || !draft.items.length} className="w-full rounded-md bg-signal px-6 py-4 text-lg font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
        {submission.status === "submitting" ? "Отправка…" : "Отправить заявку"}
      </button>
    </form>
  );
}
