export default function KpiCard({ label, value, note }) {
  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
      <div className="text-sm text-stone-500">{label}</div>
      <div className="mt-1 text-2xl sm:text-3xl font-semibold tabular-nums text-stone-900">{value}</div>
      {note && <div className="mt-1 text-xs text-stone-400">{note}</div>}
    </div>
  );
}
