import { BearingCard } from "@/components/bearing-card";
import { searchBearings } from "@/lib/catalog";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const results = searchBearings(q);
  return (
    <section className="mx-auto max-w-7xl px-5 py-16">
      <h1 className="text-4xl font-black">Поиск</h1>
      <form className="mt-6 flex max-w-3xl gap-3"><input name="q" defaultValue={q} className="min-h-12 flex-1 rounded-md border border-steel bg-white px-4" /><button className="rounded-md bg-signal px-6 font-semibold text-white">Найти</button></form>
      <p className="mt-6 text-sm text-neutral-600">Найдено: {results.length}</p>
      {results.length ? <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{results.map((bearing) => <BearingCard key={bearing.slug} bearing={bearing} />)}</div> : <div className="mt-8 rounded-xl border border-steel bg-white p-8">Совпадений нет. Отправьте обозначение, фото или чертёж специалисту.</div>}
    </section>
  );
}
