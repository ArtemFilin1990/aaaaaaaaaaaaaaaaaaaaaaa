import { BearingCard } from "@/components/bearing-card";
import { parseSearchQuery, searchCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string | string[] };

function readQuery(q: SearchParams["q"]): string {
  if (Array.isArray(q)) return q[0] ?? "";
  return q ?? "";
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = readQuery(params.q);
  const request = parseSearchQuery(q);
  const results = await searchCatalog(q);
  const warnings = Array.from(new Set(results.flatMap((result) => result.warnings)));
  return (
    <section className="mx-auto max-w-7xl px-5 py-16">
      <h1 className="text-4xl font-black">Поиск</h1>
      <form className="mt-6 flex max-w-3xl gap-3"><input name="q" defaultValue={request.rawQuery} className="min-h-12 flex-1 rounded-md border border-steel bg-white px-4" /><button className="rounded-md bg-signal px-6 font-semibold text-white">Найти</button></form>
      {request.rawQuery.trim() ? <p className="mt-6 text-sm text-neutral-600">Исходный запрос: <span className="font-mono">{request.rawQuery}</span>. Найдено: {results.length}</p> : <p className="mt-6 text-sm text-neutral-600">Введите ГОСТ, ISO, артикул, обозначение производителя или точные размеры. Пустой запрос не возвращает каталог целиком.</p>}
      {warnings.map((warning) => <p key={warning} className="mt-3 rounded-md border border-signal/30 bg-white p-3 text-sm text-signal">{warning}</p>)}
      {results.length ? <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{results.map((result) => <BearingCard key={`${result.product.slug}-${result.matchKind}`} bearing={result.product} reason={result.humanReadableReason} warnings={result.warnings} />)}</div> : request.rawQuery.trim() ? <div className="mt-8 rounded-xl border border-steel bg-white p-8">Совпадений нет. Отправьте обозначение, фото или чертёж специалисту.</div> : null}
    </section>
  );
}
