export function LoadingState({ label = 'Loading…' }: { label?: string }) { return <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-600" role="status">{label}</div>; }
