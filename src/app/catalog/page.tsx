import type { Metadata } from "next";
import Link from "next/link";
import { BearingCard } from "@/components/bearing-card";
import { filterCatalog, parseCatalogFilters, toCatalogQuery, type CatalogFilters } from "@/lib/catalog-filters";
import { catalogRepository } from "@/lib/catalog";

export const metadata: Metadata = { title: "Каталог" };

const PAGE_SIZE = 6;
const formatDimension = (value?: number) => (value == null ? "—" : `${value}`);
const supplyLabels: Record<string, string> = {
  ON_REQUEST: "Под заказ",
  CHECK_AVAILABILITY: "Уточнить наличие",
  EXPECTED: "Ожидается",
  DISCONTINUED: "Снято с поставки",
  UNKNOWN: "Статус не подтверждён"
};

function uniqueValues(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function activeFilterItems(filters: CatalogFilters) {
  const labels: Array<[keyof CatalogFilters, string]> = [
    ["brand", "Бренд"],
    ["type", "Категория"],
    ["d", "d"],
    ["D", "D"],
    ["B", "B/H"],
    ["clearance", "Зазор"],
    ["precision", "Точность"],
    ["seals", "Уплотнение"],
    ["supply", "Поставка"]
  ];
  return labels.flatMap(([key, label]) => {
    const value = filters[key];
    if (value == null || value === "") return [];
    return [{ key, label, value: String(value) }];
  });
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const rawParams = await searchParams;
  const filters = parseCatalogFilters(rawParams);
  const allProducts = await catalogRepository.list({ limit: 1000 });
  const filtered = filterCatalog(allProducts, filters);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(filters.page, totalPages);
  const pageProducts = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const brands = uniqueValues(allProducts.map((product) => product.brand));
  const types = uniqueValues(allProducts.map((product) => product.type));
  const clearances = uniqueValues(allProducts.map((product) => product.clearance));
  const precisions = uniqueValues(allProducts.map((product) => product.precisionClass));
  const seals = uniqueValues(allProducts.map((product) => product.seals));
  const active = activeFilterItems(filters);

  return (
    <section className="mx-auto max-w-7xl px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Демонстрационные данные</p>
      <h1 className="mt-4 text-5xl font-black">Каталог подшипников</h1>
      <p className="mt-5 max-w-3xl text-neutral-600">Позиции предназначены для проверки интерфейса. Цена, наличие и срок поставки подтверждаются только после обработки заявки.</p>

      <form className="mt-10 grid gap-4 rounded-xl border border-steel bg-white p-5 md:grid-cols-3 xl:grid-cols-5" method="get">
        <label className="text-sm font-semibold">Бренд
          <select name="brand" defaultValue={filters.brand ?? ""} className="mt-2 min-h-11 w-full rounded-md border border-steel px-3 font-normal">
            <option value="">Все</option>{brands.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Категория
          <select name="type" defaultValue={filters.type ?? ""} className="mt-2 min-h-11 w-full rounded-md border border-steel px-3 font-normal">
            <option value="">Все</option>{types.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Внутренний диаметр d
          <input name="d" type="number" step="any" defaultValue={filters.d ?? ""} className="mt-2 min-h-11 w-full rounded-md border border-steel px-3 font-normal" />
        </label>
        <label className="text-sm font-semibold">Наружный диаметр D
          <input name="D" type="number" step="any" defaultValue={filters.D ?? ""} className="mt-2 min-h-11 w-full rounded-md border border-steel px-3 font-normal" />
        </label>
        <label className="text-sm font-semibold">Ширина B/H
          <input name="B" type="number" step="any" defaultValue={filters.B ?? ""} className="mt-2 min-h-11 w-full rounded-md border border-steel px-3 font-normal" />
        </label>
        <label className="text-sm font-semibold">Зазор
          <select name="clearance" defaultValue={filters.clearance ?? ""} className="mt-2 min-h-11 w-full rounded-md border border-steel px-3 font-normal">
            <option value="">Все</option>{clearances.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Точность
          <select name="precision" defaultValue={filters.precision ?? ""} className="mt-2 min-h-11 w-full rounded-md border border-steel px-3 font-normal">
            <option value="">Все</option>{precisions.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Уплотнение
          <select name="seals" defaultValue={filters.seals ?? ""} className="mt-2 min-h-11 w-full rounded-md border border-steel px-3 font-normal">
            <option value="">Все</option>{seals.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Статус поставки
          <select name="supply" defaultValue={filters.supply ?? ""} className="mt-2 min-h-11 w-full rounded-md border border-steel px-3 font-normal">
            <option value="">Все</option>
            {Object.entries(supplyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <div className="flex items-end gap-3">
          <button className="min-h-11 rounded-md bg-signal px-5 font-semibold text-white">Применить</button>
          <Link href="/catalog" className="inline-flex min-h-11 items-center rounded-md border border-steel px-4 font-semibold">Сбросить</Link>
        </div>
      </form>

      {active.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {active.map((item) => (
            <Link key={item.key} href={toCatalogQuery(filters, { [item.key]: undefined, page: 1 })} className="rounded-full border border-steel bg-white px-3 py-1 text-sm">
              {item.label}: {item.value} ×
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-8 flex items-center justify-between gap-4">
        <p className="text-sm text-neutral-600">Найдено позиций: {filtered.length}</p>
        <p className="text-sm text-neutral-600">Страница {currentPage} из {totalPages}</p>
      </div>

      {pageProducts.length ? (
        <>
          <div className="mt-6 grid gap-5 md:hidden">{pageProducts.map((bearing) => <BearingCard key={bearing.slug} bearing={bearing} />)}</div>
          <div className="mt-6 hidden overflow-x-auto rounded-xl border border-steel bg-white md:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-warm-white"><tr><th className="p-4">Обозначение</th><th className="p-4">ГОСТ</th><th className="p-4">Бренд</th><th className="p-4">Тип</th><th className="p-4">d</th><th className="p-4">D</th><th className="p-4">B/H</th><th className="p-4">Зазор</th><th className="p-4">Уплотнение</th><th className="p-4">Поставка</th></tr></thead>
              <tbody>{pageProducts.map((bearing) => <tr key={bearing.slug} className="border-t border-steel"><td className="p-4 font-mono"><Link className="font-semibold text-signal" href={`/product/${bearing.slug}`}>{bearing.iso ?? bearing.sku}</Link></td><td className="p-4 font-mono">{bearing.gost ?? "—"}</td><td className="p-4">{bearing.brand ?? "—"}</td><td className="p-4">{bearing.type}</td><td className="p-4 font-mono">{formatDimension(bearing.d)}</td><td className="p-4 font-mono">{formatDimension(bearing.D)}</td><td className="p-4 font-mono">{formatDimension(bearing.B)}</td><td className="p-4">{bearing.clearance ?? "—"}</td><td className="p-4">{bearing.seals ?? "Открытый"}</td><td className="p-4">{supplyLabels[bearing.supplyStatus ?? "UNKNOWN"]}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      ) : <div className="mt-6 rounded-xl border border-steel bg-white p-8"><h2 className="font-bold">По выбранным параметрам ничего не найдено</h2><p className="mt-2 text-sm text-neutral-600">Сбросьте часть фильтров или отправьте параметры специалисту.</p></div>}

      {totalPages > 1 ? <nav className="mt-8 flex gap-3" aria-label="Пагинация">{currentPage > 1 ? <Link className="rounded-md border border-steel px-4 py-2" href={toCatalogQuery(filters, { page: currentPage - 1 })}>← Назад</Link> : null}{currentPage < totalPages ? <Link className="rounded-md border border-steel px-4 py-2" href={toCatalogQuery(filters, { page: currentPage + 1 })}>Вперёд →</Link> : null}</nav> : null}
    </section>
  );
}
