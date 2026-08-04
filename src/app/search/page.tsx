import { BearingCard } from "@/components/bearing-card";
import { searchBearingResults } from "@/lib/catalog";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const results = searchBearingResults(q);

  return (
    <section className="mx-auto max-w-7xl px-5 py-16">
      <h1 className="text-4xl font-black">Поиск</h1>
      <form className="mt-6 flex max-w-3xl gap-3">
        <label className="sr-only" htmlFor="catalog-search">Обозначение или размеры</label>
        <input id="catalog-search" name="q" defaultValue={q} placeholder="205, 6205-2RS-C3 или 25×52×15" className="min-h-12 flex-1 rounded-md border border-steel bg-white px-4" />
        <button className="rounded-md bg-signal px-6 font-semibold text-white">Найти</button>
      </form>

      {q ? <p className="mt-6 text-sm text-neutral-600">Найдено: {results.length}</p> : <p className="mt-6 text-sm text-neutral-600">Введите ГОСТ, ISO, модификацию или размеры.</p>}

      {results.length ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {results.map((result) => (
            <div key={result.product.slug} className="space-y-3">
              <BearingCard bearing={result.product} />
              <div className="rounded-lg border border-steel bg-warm-white p-4 text-sm">
                <p className="font-semibold">{result.explanation}</p>
                <p className="mt-1 font-mono text-xs text-neutral-600">Совпало: {result.matchedValue}</p>
                {result.technicalWarning ? <p className="mt-2 text-xs text-neutral-700">Внимание: {result.technicalWarning}</p> : null}
              </div>
            </div>
          ))}
        </div>
      ) : q ? (
        <div className="mt-8 rounded-xl border border-steel bg-white p-8">
          <h2 className="font-bold">Точного результата нет</h2>
          <p className="mt-2 text-sm text-neutral-600">Отправьте обозначение, фотографию, чертёж или спецификацию специалисту. Результат подбора должен быть проверен по условиям эксплуатации.</p>
        </div>
      ) : null}
    </section>
  );
}
