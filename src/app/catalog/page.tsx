import type { Metadata } from "next";
import { BearingCard } from "@/components/bearing-card";
import { listDemoBearings } from "@/lib/catalog";
import type { CatalogProductView } from "@/lib/types";

export const metadata: Metadata = { title: "Каталог" };
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const bearings: CatalogProductView[] = await listDemoBearings(24);
  return (
    <section className="mx-auto max-w-7xl px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Демонстрационные данные</p>
      <h1 className="mt-4 text-5xl font-black">Каталог подшипников</h1>
      <p className="mt-5 max-w-2xl text-neutral-600">Позиции загружаются из PostgreSQL и предназначены для проверки интерфейса; они не подтверждают цену, наличие или срок поставки.</p>
      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{bearings.map((bearing) => <BearingCard key={bearing.slug} bearing={bearing} />)}</div>
    </section>
  );
}
