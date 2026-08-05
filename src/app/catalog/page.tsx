import type { Metadata } from "next";
import Link from "next/link";
import { BearingCard } from "@/components/bearing-card";
import { activeCatalogFilterLabels, buildCatalogHref, parseCatalogFilters } from "@/lib/catalog-filters";
import { listCatalog } from "@/lib/catalog";
import type { CatalogProductView } from "@/lib/types";

export const metadata: Metadata = { title: "Каталог" };
export const dynamic = "force-dynamic";

type CatalogSearchParams = Record<string, string | string[] | undefined>;

export default async function CatalogPage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  const filters = parseCatalogFilters(await searchParams);
  const result = await listCatalog(filters);
  const activeFilters = activeCatalogFilterLabels(filters);
  return (
    <section className="mx-auto max-w-7xl px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Серверный каталог</p>
      <h1 className="mt-4 text-5xl font-black">Каталог подшипников</h1>
      <p className="mt-5 max-w-3xl text-neutral-600">Фильтры применяются на сервере и сохраняются в URL. Статус поставки не является подтверждённым наличием; цену и сроки проверяет менеджер после заявки.</p>

      <form className="mt-10 grid gap-4 rounded-2xl border border-steel bg-white p-5 md:grid-cols-3 xl:grid-cols-6">
        <label className="grid gap-1 text-sm font-semibold">Поиск<input name="q" defaultValue={filters.q} className="min-h-11 rounded-md border border-steel px-3 font-normal" /></label>
        <label className="grid gap-1 text-sm font-semibold">Бренд<input name="brand" defaultValue={filters.brand} className="min-h-11 rounded-md border border-steel px-3 font-normal" /></label>
        <label className="grid gap-1 text-sm font-semibold">Тип<input name="type" defaultValue={filters.type} className="min-h-11 rounded-md border border-steel px-3 font-normal" /></label>
        <label className="grid gap-1 text-sm font-semibold">ГОСТ<input name="gost" defaultValue={filters.gost} className="min-h-11 rounded-md border border-steel px-3 font-normal" /></label>
        <label className="grid gap-1 text-sm font-semibold">ISO<input name="iso" defaultValue={filters.iso} className="min-h-11 rounded-md border border-steel px-3 font-normal" /></label>
        <label className="grid gap-1 text-sm font-semibold">Категория<input name="category" defaultValue={filters.category} className="min-h-11 rounded-md border border-steel px-3 font-normal" /></label>
        <label className="grid gap-1 text-sm font-semibold">d<input name="d" inputMode="decimal" defaultValue={filters.d} className="min-h-11 rounded-md border border-steel px-3 font-normal" /></label>
        <label className="grid gap-1 text-sm font-semibold">D<input name="D" inputMode="decimal" defaultValue={filters.D} className="min-h-11 rounded-md border border-steel px-3 font-normal" /></label>
        <label className="grid gap-1 text-sm font-semibold">B/H<input name="B" inputMode="decimal" defaultValue={filters.B} className="min-h-11 rounded-md border border-steel px-3 font-normal" /></label>
        <label className="grid gap-1 text-sm font-semibold">Уплотнение<input name="seal" defaultValue={filters.seal} className="min-h-11 rounded-md border border-steel px-3 font-normal" /></label>
        <label className="grid gap-1 text-sm font-semibold">Сортировка<select name="sort" defaultValue={filters.sort} className="min-h-11 rounded-md border border-steel px-3 font-normal"><option value="relevance">По релевантности</option><option value="designation">По обозначению</option><option value="name">По наименованию</option><option value="d">По d</option><option value="D">По D</option><option value="B">По B/H</option></select></label>
        <div className="flex items-end gap-3"><button className="min-h-11 rounded-md bg-signal px-5 font-semibold text-white">Применить</button><Link href="/catalog" className="inline-flex min-h-11 items-center rounded-md border border-steel px-4 font-semibold">Сброс</Link></div>
      </form>

      {activeFilters.length ? <div className="mt-5 flex flex-wrap gap-2">{activeFilters.map((label) => <span key={label} className="rounded-full border border-signal/30 bg-white px-3 py-1 text-sm text-navy">{label}</span>)}</div> : null}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-sm text-neutral-600"><p>Найдено: {result.totalCount}. Страница {result.page} из {result.pageCount}.</p><p>Совпадение размеров не подтверждает взаимозаменяемость.</p></div>

      {result.products.length ? <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{result.products.map((bearing: CatalogProductView) => <BearingCard key={bearing.slug} bearing={bearing} />)}</div> : <div className="mt-8 rounded-xl border border-steel bg-white p-8">По заданным фильтрам совпадений нет. Сбросьте часть параметров или отправьте заявку на подбор.</div>}

      <nav className="mt-10 flex items-center justify-between" aria-label="Пагинация каталога">
        {result.page > 1 ? <Link className="rounded-md border border-steel px-4 py-2 font-semibold" href={buildCatalogHref(filters, { page: result.page - 1 })}>← Назад</Link> : <span />}
        {result.page < result.pageCount ? <Link className="rounded-md border border-steel px-4 py-2 font-semibold" href={buildCatalogHref(filters, { page: result.page + 1 })}>Вперёд →</Link> : <span />}
      </nav>
    </section>
  );
}
