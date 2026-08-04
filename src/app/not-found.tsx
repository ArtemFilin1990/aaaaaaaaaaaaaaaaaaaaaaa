import Link from "next/link";
export default function NotFound() { return <section className="mx-auto max-w-4xl px-5 py-24"><p className="font-mono text-signal">404</p><h1 className="mt-3 text-5xl font-black">Страница не найдена</h1><Link href="/" className="mt-8 inline-block font-semibold text-signal">На главную →</Link></section>; }
