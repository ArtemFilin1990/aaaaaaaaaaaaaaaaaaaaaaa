import Link from "next/link";
import type { Bearing } from "@/lib/types";

export function BearingCard({ bearing }: { bearing: Bearing }) {
  return (
    <article className="rounded-xl border border-steel bg-white p-5 shadow-sm">
      <p className="font-mono text-xs text-navy">{bearing.gost ? `ГОСТ ${bearing.gost}` : "ГОСТ не указан"}</p>
      <h2 className="mt-2 text-xl font-bold">{bearing.iso ?? bearing.name}</h2>
      <p className="mt-2 text-sm text-neutral-600">{bearing.type}</p>
      <dl className="mt-5 grid grid-cols-3 gap-2 text-sm">
        <div><dt className="text-neutral-500">d</dt><dd className="font-mono">{bearing.d} мм</dd></div>
        <div><dt className="text-neutral-500">D</dt><dd className="font-mono">{bearing.D} мм</dd></div>
        <div><dt className="text-neutral-500">B</dt><dd className="font-mono">{bearing.B} мм</dd></div>
      </dl>
      <p className="mt-4 text-xs text-neutral-500">{bearing.note}</p>
      <Link href={`/product/${bearing.slug}`} className="mt-5 inline-block font-semibold text-signal">Открыть карточку →</Link>
    </article>
  );
}
