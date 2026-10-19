export default function Loading(){
 return <div className="mx-auto w-full max-w-7xl p-4 sm:p-6" role="status" aria-live="polite">
  <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
   <p className="text-sm font-semibold">Seite wird geladen …</p>
   <div className="mt-5 grid gap-4 sm:grid-cols-3" aria-hidden="true">{[0,1,2].map(id=><div key={id} className="h-24 rounded-2xl bg-[var(--surface-2)]"/>)}</div>
  </div>
 </div>;
}
