export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">ЭВЕРЕСТ · B2B</p>
      <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">{title}</h1>
      <p className="mt-6 max-w-2xl text-lg text-neutral-600">{description}</p>
      <div className="mt-10 rounded-xl border border-dashed border-steel bg-white p-8 text-sm text-neutral-600">Раздел создан в техническом каркасе и будет наполнен на следующем этапе.</div>
    </section>
  );
}
