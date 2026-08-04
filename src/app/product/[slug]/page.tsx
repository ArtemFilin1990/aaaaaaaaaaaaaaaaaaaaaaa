import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogRepository } from "@/lib/catalog";

const supplyLabels: Record<string, string> = {
  ON_REQUEST: "Поставка под заказ",
  CHECK_AVAILABILITY: "Наличие и срок требуют подтверждения",
  EXPECTED: "Ожидается поступление",
  DISCONTINUED: "Снято с поставки",
  UNKNOWN: "Статус поставки не подтверждён"
};

const analogLabels: Record<string, string> = {
  DIRECT: "DIRECT — прямое соответствие по указанному источнику",
  ONE_WAY: "ONE-WAY — замена допустима только в одном направлении",
  PARTIAL: "PARTIAL — частичное соответствие",
  SIZE_ONLY: "SIZE ONLY — совпадают только размеры",
  NO_DIRECT: "NO DIRECT — прямой замены нет",
  CONFLICT: "CONFLICT — конфликт данных или обозначений"
};

const format = (value: number | undefined, unit = "") => value == null ? undefined : `${value}${unit ? ` ${unit}` : ""}`;

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [bearing, analogs] = await Promise.all([
    catalogRepository.findBySlug(slug),
    catalogRepository.getAnalogs(slug)
  ]);
  if (!bearing) notFound();

  const specifications = [
    ["Внутренний диаметр d", format(bearing.d, "мм")],
    ["Наружный диаметр D", format(bearing.D, "мм")],
    ["Ширина B/H", format(bearing.B, "мм")],
    ["Масса", format(bearing.massKg, "кг")],
    ["Внутренний зазор", bearing.clearance],
    ["Класс точности", bearing.precisionClass],
    ["Уплотнение", bearing.seals ?? (bearing.d != null ? "Открытое исполнение" : undefined)],
    ["Сепаратор", bearing.cage],
    ["Материал колец", bearing.ringMaterial],
    ["Материал тел качения", bearing.rollingElementMaterial],
    ["Минимальная температура", format(bearing.temperatureMinC, "°C")],
    ["Максимальная температура", format(bearing.temperatureMaxC, "°C")],
    ["Динамическая грузоподъёмность", format(bearing.dynamicLoadKn, "кН")],
    ["Статическая грузоподъёмность", format(bearing.staticLoadKn, "кН")],
    ["Предельная частота вращения", format(bearing.limitingSpeedRpm, "об/мин")]
  ].filter((item): item is [string, string] => Boolean(item[1]));

  return (
    <section className="mx-auto max-w-7xl px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">{bearing.note ?? "Техническая карточка"}</p>
      <h1 className="mt-4 text-5xl font-black">{bearing.iso ?? bearing.name}</h1>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <span className="rounded-full border border-steel bg-white px-3 py-1">ГОСТ: {bearing.gost ?? "не указан"}</span>
        <span className="rounded-full border border-steel bg-white px-3 py-1">Бренд: {bearing.brand ?? "не указан"}</span>
        <span className="rounded-full border border-steel bg-white px-3 py-1">{bearing.type}</span>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-xl border border-steel bg-white p-8">
          <h2 className="text-2xl font-bold">Технические характеристики</h2>
          {specifications.length ? (
            <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {specifications.map(([label, value]) => (
                <div key={label} className="border-b border-steel pb-3">
                  <dt className="text-sm text-neutral-500">{label}</dt>
                  <dd className="mt-1 font-mono font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          ) : <p className="mt-6 text-neutral-600">Характеристики требуют уточнения.</p>}
          <p className="mt-8 text-sm text-neutral-500">Технические характеристики, применимость и взаимозаменяемость необходимо подтвердить по каталогу производителя и условиям эксплуатации.</p>
        </div>

        <aside className="rounded-xl bg-navy p-8 text-white">
          <h2 className="text-2xl font-bold">Запросить предложение</h2>
          <p className="mt-4 text-steel">{supplyLabels[bearing.supplyStatus ?? "UNKNOWN"]}. Публичная цена не используется.</p>
          <div className="mt-6 grid gap-3">
            <Link href={`/request?product=${encodeURIComponent(bearing.slug)}`} className="rounded-md bg-signal px-5 py-3 text-center font-semibold">Добавить в заявку</Link>
            <Link href={`/request?product=${encodeURIComponent(bearing.slug)}&topic=analog`} className="rounded-md border border-steel px-5 py-3 text-center font-semibold">Уточнить аналог</Link>
            <Link href={`/request?product=${encodeURIComponent(bearing.slug)}&topic=engineering`} className="rounded-md border border-steel px-5 py-3 text-center font-semibold">Отправить данные специалисту</Link>
          </div>
        </aside>
      </div>

      <section className="mt-12">
        <h2 className="text-3xl font-black">Аналоги и кандидаты</h2>
        <p className="mt-3 max-w-3xl text-neutral-600">Статус связи отражает уровень технического соответствия. Кандидаты с PARTIAL, SIZE ONLY или CONFLICT не являются подтверждённой полной заменой.</p>
        {analogs.length ? (
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {analogs.map((analog) => (
              <article key={`${bearing.slug}-${analog.product.slug}`} className="rounded-xl border border-steel bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-mono text-xs text-navy">{analog.product.gost ? `ГОСТ ${analog.product.gost}` : "ГОСТ не указан"}</p><h3 className="mt-1 text-xl font-bold">{analog.product.iso ?? analog.product.name}</h3></div>
                  <span className="rounded-full bg-warm-white px-3 py-1 text-xs font-semibold">Доказательность {analog.evidenceLevel}</span>
                </div>
                <p className="mt-4 font-semibold">{analogLabels[analog.status]}</p>
                {analog.matchingAttributes.length ? <div className="mt-4"><h4 className="text-sm font-semibold">Совпадает</h4><p className="mt-1 text-sm text-neutral-600">{analog.matchingAttributes.join(", ")}</p></div> : null}
                {analog.differingAttributes.length ? <div className="mt-4"><h4 className="text-sm font-semibold">Отличается или требует проверки</h4><p className="mt-1 text-sm text-neutral-600">{analog.differingAttributes.join(", ")}</p></div> : null}
                {analog.warning ? <p className="mt-4 rounded-lg border border-steel bg-warm-white p-3 text-sm">Внимание: {analog.warning}</p> : null}
                <Link href={`/product/${analog.product.slug}`} className="mt-5 inline-block font-semibold text-signal">Открыть кандидата →</Link>
              </article>
            ))}
          </div>
        ) : <div className="mt-6 rounded-xl border border-steel bg-white p-6"><p className="font-semibold">Проверенные связи не добавлены</p><p className="mt-2 text-sm text-neutral-600">Отправьте обозначение и условия эксплуатации специалисту для подбора.</p></div>}
      </section>
    </section>
  );
}
