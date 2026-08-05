import Link from "next/link";
import type { CatalogProductView } from "@/lib/types";

export function BearingCard({ bearing, reason, warnings = [] }: { bearing: CatalogProductView; reason?: string; warnings?: string[] }) {
  return (
    <article className="rounded-xl border border-steel bg-white p-5 shadow-sm">
      <p className="font-mono text-xs text-navy">{bearing.gost ? `ГОСТ ${bearing.gost}` : "ГОСТ не указан"}</p>
      <h2 className="mt-2 text-xl font-bold">{bearing.iso ?? bearing.name}</h2>
      <p className="mt-2 text-sm text-neutral-600">{bearing.bearingType}</p>
      {reason ? <p className="mt-3 rounded-md bg-cream px-3 py-2 text-sm font-medium text-navy">{reason}</p> : null}
      <dl className="mt-5 grid grid-cols-3 gap-2 text-sm">
        <div><dt className="text-neutral-500">d</dt><dd className="font-mono">{bearing.boreDiameter} {bearing.dimensionUnit}</dd></div>
        <div><dt className="text-neutral-500">D</dt><dd className="font-mono">{bearing.outerDiameter} {bearing.dimensionUnit}</dd></div>
        <div><dt className="text-neutral-500">B/H</dt><dd className="font-mono">{bearing.widthOrHeight} {bearing.dimensionUnit}</dd></div>
      </dl>
      <p className="mt-4 text-xs text-neutral-500">Демонстрационные данные. Наличие, цена и сроки не подтверждены.</p>
      {warnings.map((warning) => <p key={warning} className="mt-3 text-xs text-signal">{warning}</p>)}
      <Link href={`/product/${bearing.slug}`} className="mt-5 inline-block font-semibold text-signal">Открыть карточку →</Link>
    </article>
  );
}
