import { notFound } from "next/navigation";
import { getBearing } from "@/lib/catalog";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bearing = getBearing(slug);
  if (!bearing) notFound();
  return (
    <section className="mx-auto max-w-7xl px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Демонстрационная карточка</p>
      <h1 className="mt-4 text-5xl font-black">{bearing.iso ?? bearing.name}</h1>
      <p className="mt-3 text-xl text-neutral-600">ГОСТ: {bearing.gost ?? "не указан"}</p>
      <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-steel bg-white p-8"><h2 className="text-2xl font-bold">Технические характеристики</h2><dl className="mt-6 grid grid-cols-3 gap-4"><div><dt>d</dt><dd className="font-mono text-xl">{bearing.d} мм</dd></div><div><dt>D</dt><dd className="font-mono text-xl">{bearing.D} мм</dd></div><div><dt>B</dt><dd className="font-mono text-xl">{bearing.B} мм</dd></div></dl><p className="mt-8 text-sm text-neutral-500">{bearing.note}. Характеристики и взаимозаменяемость необходимо подтвердить.</p></div>
        <aside className="rounded-xl bg-navy p-8 text-white"><h2 className="text-2xl font-bold">Запросить предложение</h2><p className="mt-4 text-steel">Добавление в заявку и интеграция Bitrix24 будут подключены отдельным этапом.</p><a href="/request" className="mt-6 inline-block rounded-md bg-signal px-5 py-3 font-semibold">Перейти к заявке</a></aside>
      </div>
    </section>
  );
}
