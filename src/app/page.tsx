import Link from "next/link";


export default function HomePage() {
  return (
    <>
      <section className="bg-graphite text-white">
        <div className="mx-auto max-w-7xl px-5 py-20 md:py-28">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-signal">Промышленное снабжение</p>
          <h1 className="mt-5 max-w-5xl text-5xl font-black tracking-tight md:text-7xl">Подшипники и комплектующие для предприятий</h1>
          <p className="mt-6 max-w-2xl text-lg text-steel">Поиск по ГОСТ, ISO, размерам и техническим признакам. Результаты требуют проверки перед поставкой.</p>
          <form action="/search" className="mt-10 flex max-w-3xl flex-col gap-3 sm:flex-row">
            <input name="q" aria-label="Обозначение или размеры" placeholder="6205, 205, 80205 или 25×52×15" className="min-h-12 flex-1 rounded-md border border-white/20 bg-white px-4 text-graphite outline-none focus:ring-2 focus:ring-signal" />
            <button className="min-h-12 rounded-md bg-signal px-6 font-semibold">Найти подшипник</button>
          </form>
          <div className="mt-6 flex flex-wrap gap-4 text-sm"><Link href="/selection" className="text-white underline underline-offset-4">Подобрать по параметрам</Link><Link href="/request" className="text-white underline underline-offset-4">Загрузить спецификацию</Link></div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-16">
        <div className="flex items-end justify-between gap-4"><div><p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Демо-каталог</p><h2 className="mt-3 text-3xl font-black">Популярные обозначения</h2></div><Link href="/catalog" className="font-semibold text-signal">Весь каталог →</Link></div>
        <p className="mt-8 rounded-xl border border-steel bg-white p-5 text-neutral-600">Демонстрационный каталог и поиск работают через PostgreSQL. Перейдите в каталог или используйте поиск по обозначению.</p>
      </section>
    </>
  );
}
