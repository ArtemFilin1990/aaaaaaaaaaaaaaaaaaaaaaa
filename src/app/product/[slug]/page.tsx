import { notFound } from "next/navigation";
import { getBearingDetail } from "@/lib/catalog";

export const dynamic = "force-dynamic";

function Spec({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return <div className="rounded-lg border border-steel bg-white p-4"><dt className="text-sm text-neutral-500">{label}</dt><dd className="mt-1 font-mono text-lg">{value}</dd></div>;
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bearing = await getBearingDetail(slug);
  if (!bearing) notFound();
  return (
    <section className="mx-auto max-w-7xl px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Карточка из PostgreSQL</p>
      <h1 className="mt-4 text-5xl font-black">{bearing.iso ?? bearing.name}</h1>
      <p className="mt-3 max-w-3xl text-xl text-neutral-600">{bearing.name}</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div>
          <h2 className="text-2xl font-bold">Технические характеристики</h2>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Spec label="Внутренний артикул" value={bearing.internalSku} />
            <Spec label="Обозначение производителя" value={bearing.manufacturerDesignation} />
            <Spec label="ГОСТ" value={bearing.gost} />
            <Spec label="ISO" value={bearing.iso} />
            <Spec label="Бренд" value={bearing.brand} />
            <Spec label="Категория" value={bearing.category} />
            <Spec label="Тип" value={bearing.bearingType} />
            <Spec label="d" value={`${bearing.boreDiameter} ${bearing.dimensionUnit}`} />
            <Spec label="D" value={`${bearing.outerDiameter} ${bearing.dimensionUnit}`} />
            <Spec label="B/H" value={`${bearing.widthOrHeight} ${bearing.dimensionUnit}`} />
            <Spec label="Масса, кг" value={bearing.massKg} />
            <Spec label="Зазор" value={bearing.clearance} />
            <Spec label="Класс точности" value={bearing.precision} />
            <Spec label="Уплотнение" value={bearing.seal} />
            <Spec label="Сепаратор" value={bearing.cage} />
            <Spec label="Динамическая нагрузка" value={bearing.dynamicLoadRating ? `${bearing.dynamicLoadRating} ${bearing.loadRatingUnit ?? ""}` : null} />
            <Spec label="Статическая нагрузка" value={bearing.staticLoadRating ? `${bearing.staticLoadRating} ${bearing.loadRatingUnit ?? ""}` : null} />
            <Spec label="Предельные обороты" value={bearing.limitingSpeedRpm} />
            <Spec label="Референсные обороты" value={bearing.referenceSpeedRpm} />
            <Spec label="Температура min" value={bearing.temperatureMinC === null ? null : `${bearing.temperatureMinC} °C`} />
            <Spec label="Температура max" value={bearing.temperatureMaxC === null ? null : `${bearing.temperatureMaxC} °C`} />
          </dl>
          <p className="mt-8 rounded-xl border border-signal/30 bg-white p-4 text-sm text-neutral-700">Данные требуют проверки перед применением. Совпадение размеров или поиска не является подтверждённой взаимозаменяемостью.</p>
        </div>
        <aside className="rounded-xl bg-navy p-8 text-white"><h2 className="text-2xl font-bold">Запросить предложение</h2><p className="mt-4 text-steel">Цена, срок и применимость проверяются менеджером после заявки. Онлайн-оплата и публичные остатки не используются.</p><a href="/request" className="mt-6 inline-block rounded-md bg-signal px-5 py-3 font-semibold">Добавить в заявку</a></aside>
      </div>
      <section className="mt-12"><h2 className="text-3xl font-black">Возможные аналоги</h2>{bearing.analogs.length ? <div className="mt-6 grid gap-4">{bearing.analogs.map((analog) => <article key={analog.id} className="rounded-xl border border-steel bg-white p-5"><h3 className="text-xl font-bold">{analog.target.iso ?? analog.target.name}</h3><p className="mt-2 font-semibold text-navy">{analog.statusLabel}</p><p className="mt-1 text-sm text-neutral-600">{analog.evidenceLabel}</p>{analog.note ? <p className="mt-3 text-sm">{analog.note}</p> : null}{analog.warnings.map((warning) => <p key={warning} className="mt-3 rounded-md border border-signal/30 bg-cream p-3 text-sm text-signal">{warning}</p>)}</article>)}</div> : <p className="mt-4 rounded-xl border border-steel bg-white p-5 text-neutral-600">Подтверждённые аналоги для этой позиции не внесены.</p>}</section>
    </section>
  );
}
