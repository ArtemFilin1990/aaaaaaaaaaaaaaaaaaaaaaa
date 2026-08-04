export function SiteFooter() {
  return (
    <footer className="mt-20 bg-graphite text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 md:grid-cols-3">
        <div><p className="text-xl font-black">ЭВЕРЕСТ</p><p className="mt-3 text-sm text-steel">Подшипники и промышленные комплектующие для предприятий.</p></div>
        <div><p className="font-semibold">Контакты</p><p className="mt-3 text-sm text-steel">info@ewerest.ru<br />+7 (900) 553-73-30</p></div>
        <div><p className="font-semibold">Режим сайта</p><p className="mt-3 text-sm text-steel">Каталог-заявка. Публичные цены и онлайн-оплата отсутствуют.</p></div>
      </div>
    </footer>
  );
}
