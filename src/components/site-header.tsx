import Link from "next/link";

const links = [
  ["Каталог", "/catalog"],
  ["Подбор", "/selection"],
  ["Бренды", "/brands"],
  ["База знаний", "/knowledge"],
  ["О компании", "/about"],
  ["Контакты", "/contacts"]
];

export function SiteHeader() {
  return (
    <header className="border-b border-steel/60 bg-warm/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4">
        <Link href="/" className="text-xl font-black tracking-tight">ЭВЕРЕСТ</Link>
        <nav className="hidden items-center gap-5 text-sm lg:flex">
          {links.map(([label, href]) => <Link key={href} href={href} className="hover:text-signal">{label}</Link>)}
        </nav>
        <Link href="/request" className="rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white">Отправить заявку</Link>
      </div>
    </header>
  );
}
