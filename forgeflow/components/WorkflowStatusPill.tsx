export default function WorkflowStatusPill({
  isActive,
}: {
  isActive: boolean;
}) {
  return (
    <span
      title={
        isActive
          ? "This workflow accepts inbound webhooks"
          : "Paused — inbound webhooks are rejected, but you can still run it manually"
      }
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${
        isActive
          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
          : "border-white/10 bg-white/[0.03] text-slate-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isActive ? "bg-emerald-400" : "bg-slate-600"
        }`}
      />
      {isActive ? "Live" : "Paused"}
    </span>
  );
}
