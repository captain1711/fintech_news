import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAccounts, fetchExecutionStatus } from "@/lib/api";
import { Zap, Shield, Search, TrendingUp, Filter, Newspaper, Activity, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProspectPool } from "@/context/ProspectPoolContext";

export default function Signals() {
  const { selectedProspectPoolId, selectedExecutionId } = useProspectPool();

  const executionStatusQuery = useQuery({
    queryKey: ["execution-status", selectedProspectPoolId, selectedExecutionId],
    queryFn: () => fetchExecutionStatus(selectedProspectPoolId, selectedExecutionId),
    enabled: !!selectedExecutionId && !!selectedProspectPoolId,
    refetchInterval: (query) => query.state.data?.isRunning ? 3000 : false,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", selectedProspectPoolId, selectedExecutionId],
    queryFn: () => fetchAccounts(selectedProspectPoolId, selectedExecutionId),
    enabled: !!selectedExecutionId && !!selectedProspectPoolId,
    refetchInterval: executionStatusQuery.data?.isRunning ? 2000 : false,
  });

  const executionStatus = executionStatusQuery.data;

  const allSignals = useMemo(() => {
    const sigs = accounts.flatMap(acc => 
      acc.signals.map(s => ({ ...s, companyName: acc.name, companyId: acc.id }))
    );
    return sigs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [accounts]);

  const stats = [
    { label: "Articles Scanned", value: executionStatus?.articlesScanned || 0, icon: Newspaper },
    { label: "Signals Extracted", value: allSignals.length, icon: Zap },
    { label: "Avg. Intent Delta", value: "+24pts", icon: TrendingUp },
    { label: "Agent Confidence", value: "98%", icon: Shield },
  ];

  return (
    <div className="px-8 py-6 space-y-8">
      {/* Run Summary Bar */}
      <div className="grid grid-cols-4 gap-6">
        {stats.map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <s.icon className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-10 gap-8">
        {/* Signal Timeline */}
        <div className="col-span-7 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Intelligence Timeline</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">Signals detected during execution {selectedExecutionId}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input placeholder="Filter signals..." className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <button className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50"><Filter className="h-4 w-4 text-slate-400" /></button>
            </div>
          </div>

          <div className="space-y-4 relative before:absolute before:left-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-100">
            {allSignals.map((sig, idx) => (
              <div key={idx} className="relative pl-14 group">
                <div className={cn(
                  "absolute left-4 top-1 h-4 w-4 rounded-full border-4 border-white shadow-sm z-10 transition-transform group-hover:scale-125",
                  sig.type === "Funding" ? "bg-green-500" : sig.type === "Regulatory" ? "bg-amber-500" : "bg-blue-600"
                )} />
                <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-900">{sig.companyName}</span>
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">• {sig.type}</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{new Date(sig.date).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed mb-4">{sig.description}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="h-3 w-3 text-success" />
                        <span className="text-[10px] font-bold text-success">+{sig.intentScore} Intent Points</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="h-3 w-3 text-slate-300" />
                        <span className="text-[10px] font-bold text-slate-400">1 Agent Reasoning</span>
                      </div>
                    </div>
                    <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">View Source</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar: Signal Breakdown */}
        <div className="col-span-3 space-y-6">
          <div className="bg-slate-900 rounded-3xl p-6 text-white space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Categorical Breakdown</h3>
            <div className="space-y-4">
              {[
                { label: "Funding", count: allSignals.filter(s => s.type === "Funding").length, color: "bg-green-500" },
                { label: "Regulatory", count: allSignals.filter(s => s.type === "Regulatory").length, color: "bg-amber-500" },
                { label: "Product", count: allSignals.filter(s => s.type === "Product Launch").length, color: "bg-blue-500" },
                { label: "Strategic", count: allSignals.filter(s => s.type === "Partnership").length, color: "bg-purple-500" },
              ].map(cat => (
                <div key={cat.label} className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span>{cat.label}</span>
                    <span>{cat.count}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", cat.color)} style={{ width: `${(cat.count / (allSignals.length || 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-blue-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Agent Insights</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed italic">
                "High density of regulatory signals detected in this run suggests a sector-wide compliance shift. Targeting infrastructure partners now will yield 3x response rates."
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
