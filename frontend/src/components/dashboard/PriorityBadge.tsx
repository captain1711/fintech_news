import { cn } from "@/lib/utils";
import type { Priority } from "@/types/api";

const styles: Record<Priority, string> = {
  Hot: "bg-hot-soft text-hot border-hot/20",
  Warm: "bg-warm-soft text-warm border-warm/20",
  Cold: "bg-cold-soft text-cold border-cold/20",
};

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
        styles[priority],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full",
        priority === "Hot" ? "bg-hot animate-pulse" : priority === "Warm" ? "bg-warm" : "bg-cold"
      )} />
      {priority}
    </span>
  );
}

export function ScoreBar({ score, segments }: { score: number; segments?: boolean }) {
  if (segments) {
    return (
      <div className="flex flex-col gap-1 w-full max-w-[140px] group relative">
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            <div className="bg-blue-600 h-full transition-all duration-1000 ease-out" style={{ width: `${score * 0.6}%` }} />
            <div className="bg-blue-400 h-full transition-all duration-1000 delay-100 ease-out" style={{ width: `${score * 0.25}%` }} />
            <div className="bg-blue-200 h-full transition-all duration-1000 delay-200 ease-out" style={{ width: `${score * 0.15}%` }} />
          </div>
          <span className="text-[11px] font-bold text-slate-900 w-6 tabular-nums">{score}</span>
        </div>
        
        {/* Hover Tooltip for Breakdown */}
        <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#0f172a] text-white p-3 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-white/10 scale-95 group-hover:scale-100 origin-bottom duration-200">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 border-b border-white/10 pb-1">Intent Breakdown</div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-400">Signal Strength</span>
              <span className="font-bold text-blue-400">60%</span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-400">Recency Impact</span>
              <span className="font-bold text-blue-300">25%</span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-400">ICP Fit Level</span>
              <span className="font-bold text-blue-200">15%</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tone = score >= 80 ? "bg-hot" : score >= 60 ? "bg-warm" : "bg-cold";
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-1000", tone)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold tabular-nums w-7 text-right text-slate-900">{score}</span>
    </div>
  );
}
