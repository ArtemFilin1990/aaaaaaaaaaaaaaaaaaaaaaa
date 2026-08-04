export default function RequestPage() {
  return (
    <section className="mx-auto max-w-4xl px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Корзина-заявка</p>
      <h1 className="mt-4 text-5xl font-black">Получить коммерческое предложение</h1>
      <p className="mt-5 text-neutral-600">Форма пока работает как интерфейсный каркас. Реальная отправка будет подключена через серверный адаптер Bitrix24.</p>
      <form className="mt-10 grid gap-5 rounded-xl border border-steel bg-white p-6 md:grid-cols-2">
        <label className="grid gap-2 text-sm">Компания<input className="min-h-11 rounded-md border border-steel px-3" /></label>
        <label className="grid gap-2 text-sm">ИНН<input className="min-h-11 rounded-md border border-steel px-3" /></label>
        <label className="grid gap-2 text-sm">Контактное лицо<input className="min-h-11 rounded-md border border-steel px-3" /></label>
        <label className="grid gap-2 text-sm">Телефон или e-mail<input className="min-h-11 rounded-md border border-steel px-3" /></label>
        <label className="grid gap-2 text-sm md:col-span-2">Позиции и комментарий<textarea className="min-h-32 rounded-md border border-steel p-3" placeholder="Обозначение, количество, срок, допустимость аналога" /></label>
        <button type="button" className="rounded-md bg-signal px-5 py-3 font-semibold text-white md:col-span-2">Отправка будет подключена позже</button>
      </form>
    </section>
  );
}
