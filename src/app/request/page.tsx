import { RequestCartForm } from "@/components/request-cart-form";
import { catalogRepository } from "@/lib/catalog";
import type { RequestItemInput } from "@/lib/request/schema";

export default async function RequestPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product: productSlug } = await searchParams;
  const product = productSlug ? await catalogRepository.findBySlug(productSlug) : undefined;
  const initialItem: RequestItemInput | undefined = product ? {
    productSlug: product.slug,
    designation: product.iso ?? product.gost ?? product.sku,
    quantity: 1,
    unit: "шт",
    requiredDate: "",
    analogAllowed: false,
    comment: product.brand ? `Предпочтительный бренд: ${product.brand}` : ""
  } : undefined;

  return (
    <section className="mx-auto max-w-5xl px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Корзина-заявка</p>
      <h1 className="mt-4 text-5xl font-black">Получить коммерческое предложение</h1>
      <p className="mt-5 max-w-3xl text-neutral-600">Соберите спецификацию, укажите количество, срок и допустимость аналога. На текущем этапе отправка работает только в безопасном mock-режиме и не создаёт сущности в Bitrix24.</p>
      <RequestCartForm initialItem={initialItem} />
    </section>
  );
}
