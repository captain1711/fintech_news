import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowUpRight, Flame, TrendingUp, Building2, ChevronDown, Activity, Mail, Zap, Newspaper, Search, FileText, Sparkles, BarChart3, Send, CheckCircle2, Loader2, Circle, XCircle } from "lucide-react";
import { fetchAccounts, fetchExecutionStatus, fetchAlerts } from "@/lib/api";
import type { Account } from "@/types/api";
import { PriorityBadge, ScoreBar } from "@/components/dashboard/PriorityBadge";
import { cn } from "@/lib/utils";
import { useProspectPool } from "@/context/ProspectPoolContext";

export default function Dashboard() {
  const { selectedProspectPoolId, selectedExecutionId, prospectPools, setSelectedProspectPoolId, currentExecution } = useProspectPool();

  const executionStatusQuery = useQuery({
    queryKey: ["execution-status", selectedProspectPoolId, selectedExecutionId],
    queryFn: () => fetchExecutionStatus(selectedProspectPoolId, selectedExecutionId),
    enabled: !!selectedExecutionId && !!selectedProspectPoolId,
    refetchInterval: (query) => query.state.data?.isRunning ? 3000 : false,
  });

  const isLive = executionStatusQuery.data?.isRunning;

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", selectedProspectPoolId, selectedExecutionId],
    queryFn: () => fetchAccounts(selectedProspectPoolId, selectedExecutionId),
    enabled: !!selectedExecutionId && !!selectedProspectPoolId,
    refetchInterval: isLive ? 2000 : false,
  });

  useQuery({
    queryKey: ["alerts"],
    queryFn: fetchAlerts,
    refetchInterval: 10000,
  });

  const executionStatus = executionStatusQuery.data;
  const companies: Account[] = accounts;
  const top5 = companies.slice(0, 5);
  const agentMetrics = executionStatus?.agentMetrics || {};
  const completedAgents = Object.keys(agentMetrics).length;
  const currentStageIndex = currentExecution?.status === "completed"
    ? 5
    : currentExecution?.status === "failed"
      ? Math.min(completedAgents, 4)
      : Math.min(completedAgents, 4);
  const latestPipelineMessage = executionStatus?.messages?.at(-1) || (
    currentExecution?.status === "running"
      ? "Agents are starting the prospect intelligence run."
      : "Start a prospect pool run to generate live pipeline updates."
  );

  const pipelineStages = [
    {
      key: "researcher_agent",
      label: "Research",
      detail: "Collects market news and regulatory signals",
      value: `${executionStatus?.articlesScanned || currentExecution?.articles_scanned || 0} articles`,
      icon: Search,
    },
    {
      key: "extractor_agent",
      label: "Extract",
      detail: "Turns articles into structured why-now events",
      value: `${executionStatus?.totalSignals || currentExecution?.signals_extracted || 0} signals`,
      icon: FileText,
    },
    {
      key: "enricher_agent",
      label: "Enrich",
      detail: "Builds company context and account profiles",
      value: `${companies.length || currentExecution?.accounts_found || 0} profiles`,
      icon: Sparkles,
    },
    {
      key: "scorer_agent",
      label: "Score",
      detail: "Ranks accounts by urgency and fit",
      value: `${companies.filter((c) => c.priority === "Hot").length} hot`,
      icon: BarChart3,
    },
    {
      key: "outreach_agent",
      label: "Outreach",
      detail: "Drafts personalized email angles",
      value: `${companies.filter((c) => c.outreachDraft).length} drafts`,
      icon: Send,
    },
  ];

  const stats = [
    { label: "Hot accounts", value: companies.filter((c: Account) => c.priority === "Hot").length, icon: Flame, tone: "text-red-500" },
    { label: "Warm accounts", value: companies.filter((c: Account) => c.priority === "Warm").length, icon: TrendingUp, tone: "text-amber-500" },
    { label: "Accounts Found", value: companies.length, icon: Building2, tone: "text-blue-600" },
    { label: "Signals Detected", value: executionStatus?.totalSignals || 0, icon: Zap, tone: "text-blue-600" },
  ];

  return (
    <div className="px-6 py-6 space-y-6 max-w-[1600px]">
      {/* Live Pulse Banner */}
      <div className="bg-blue-600/5 border border-blue-600/10 rounded-xl px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75", currentExecution?.status === 'running' ? "animate-ping bg-blue-500" : "bg-success")}></span>
            <span className={cn("relative inline-flex rounded-full h-2 w-2", currentExecution?.status === 'running' ? "bg-blue-600" : "bg-success")}></span>
          </span>
          <p className="text-xs font-bold text-slate-900 tracking-tight">
            {currentExecution?.status === 'running' ? "Active Prospect Pool Search" : "Live Pulse active"} — 
            <span className="text-slate-500 font-medium ml-1">
              Run: {currentExecution ? new Date(currentExecution.execution_date).toLocaleString() : "None"}
            </span>
          </p>
        </div>
        <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-600/10 px-2 py-0.5 rounded">
          Execution Context: {selectedExecutionId}
        </div>
      </div>

      {/* Hero Signal Card (Dynamic based on current run) */}
      <div className="bg-[#0f172a] rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-blue-900/20 border border-white/5">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Activity className="h-32 w-32 text-blue-400" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="px-2 py-1 rounded bg-blue-600 text-[10px] font-black uppercase tracking-widest">
                {currentExecution?.status === 'running' ? "Scanning Now" : "Latest Prospect Pool Result"}
              </span>
              <span className="text-slate-400 text-xs font-medium">Run Hash: {selectedExecutionId.slice(0, 8)}</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold leading-tight">
              {companies[0] ? companies[0].whyNow : "Ready for the next prospect pool search."}
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-2 text-slate-400 font-medium">
                <Newspaper className="h-4 w-4" /> Market Pulse
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest">
                {companies[0]?.industry || "Strategy"}
              </span>
              <span className="text-slate-400 font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-400" /> Intelligence Focus: High
              </span>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 min-w-[280px]">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Run Impact</div>
            <div className="flex items-center gap-4 mb-4">
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center font-bold">
                {companies[0]?.name[0] || "S"}
              </div>
              <div>
                <div className="font-bold text-sm">{companies[0]?.name || "Select Run"}</div>
                <div className="text-xs text-success font-bold flex items-center gap-1">
                  Intent Score: {companies[0]?.score || 0} <ArrowUpRight className="h-3 w-3" />
                </div>
              </div>
            </div>
            <Link to="/emails" className="w-full h-10 bg-white text-slate-900 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors">
              <Mail className="h-3.5 w-3.5" /> View generated emails
            </Link>
          </div>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Live Agent Pipeline</h2>
            <p className="text-xs text-slate-500 mt-1">{latestPipelineMessage}</p>
          </div>
          <div className={cn(
            "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest",
            currentExecution?.status === "running" ? "bg-blue-50 text-blue-700" :
            currentExecution?.status === "failed" ? "bg-red-50 text-red-700" :
            "bg-green-50 text-green-700"
          )}>
            {currentExecution?.status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {currentExecution?.status === "failed" && <XCircle className="h-3.5 w-3.5" />}
            {currentExecution?.status === "completed" && <CheckCircle2 className="h-3.5 w-3.5" />}
            {currentExecution?.status || "waiting"}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {pipelineStages.map((stage, index) => {
            const isDone = Boolean(agentMetrics[stage.key]) || currentExecution?.status === "completed";
            const isActive = currentExecution?.status === "running" && index === currentStageIndex;
            const isFailed = currentExecution?.status === "failed" && index === currentStageIndex;
            const StageIcon = stage.icon;

            return (
              <div
                key={stage.key}
                className={cn(
                  "rounded-xl border p-4 min-h-[172px] transition-colors flex flex-col",
                  isActive ? "border-blue-300 bg-blue-50/70" :
                  isFailed ? "border-red-200 bg-red-50/70" :
                  isDone ? "border-green-200 bg-green-50/40" :
                  "border-slate-200 bg-slate-50/60"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center",
                    isActive ? "bg-blue-600 text-white" :
                    isFailed ? "bg-red-600 text-white" :
                    isDone ? "bg-green-600 text-white" :
                    "bg-white text-slate-400 border border-slate-200"
                  )}>
                    <StageIcon className="h-4 w-4" />
                  </div>
                  {isActive ? (
                    <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                  ) : isFailed ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-300" />
                  )}
                </div>
                <div className="mt-4 flex-1">
                  <div className="text-sm font-bold text-slate-900">{stage.label}</div>
                  <div className="text-[11px] text-slate-500 leading-5 mt-1 break-words">{stage.detail}</div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Step {index + 1}/5
                  </span>
                  <span className="text-[10px] font-bold text-slate-700 text-right tabular-nums">{stage.value}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Prospect Pool Execution Overview</h2>
            <div className="relative group">
              <button className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-200 bg-white text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors">
                {prospectPools.find(p => p.id === selectedProspectPoolId)?.name || "Select Prospect Pool"}
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl hidden group-hover:block z-50 overflow-hidden">
                {prospectPools.map(pool => (
                  <button
                    key={pool.id}
                    onClick={() => setSelectedProspectPoolId(pool.id)}
                    className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-slate-50 transition-colors"
                  >
                    {pool.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            Showing results from prospect pool run <span className="font-bold text-slate-900">{selectedExecutionId}</span>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</span>
              <s.icon className={cn("h-4 w-4", s.tone)} />
            </div>
            <div className="text-3xl font-bold mt-2 tabular-nums text-slate-900">{s.value}</div>
          </div>
        ))}
      </div>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Top Accounts (this run)</h3>
            <p className="text-xs text-slate-500">Accounts with highest scoring in this specific execution window.</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-4">
          {top5.map((c, i) => (
            <Link
              key={c.id}
              to={`/accounts/${c.id}`}
              className="group bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-500/50 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="text-[10px] font-bold text-slate-300">#{i + 1}</div>
                <PriorityBadge priority={c.priority} />
              </div>
              <div className="mt-3 font-bold text-sm text-slate-900">{c.name}</div>
              <div className="text-[11px] text-slate-500 font-medium">{c.industry}</div>
              
              <div className="mt-4 flex items-center gap-2">
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider",
                  c.signals[0]?.type === "Funding" ? "bg-green-500/10 text-green-600" :
                  c.signals[0]?.type === "Regulatory" ? "bg-amber-500/10 text-amber-600" :
                  "bg-purple-500/10 text-purple-600"
                )}>
                  {c.signals[0]?.type || "Strategic"}
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold tabular-nums text-slate-900">{c.score}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">Score</span>
                </div>
              </div>
              
              <div className="mt-3 text-[11px] text-slate-600 line-clamp-2 leading-relaxed font-medium">
                {c.whyNow}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Main Content Table */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Ranked Intelligence Table</h3>
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="text-left px-6 py-4">Company</th>
                <th className="text-left px-6 py-4">Intent Breakdown</th>
                <th className="text-left px-6 py-4">Key Signals</th>
                <th className="text-left px-6 py-4">Agent Reasoning</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors group cursor-pointer">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{c.name}</div>
                    <div className="text-[11px] text-slate-500 font-medium">{c.industry} · {c.size}</div>
                  </td>
                  <td className="px-6 py-4">
                    <ScoreBar score={c.score} segments />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex -space-x-1">
                      {c.signals.slice(0, 3).map((s, idx) => (
                        <div key={idx} className={cn(
                          "h-6 w-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black uppercase tracking-tighter",
                          s.type === "Funding" ? "bg-green-500 text-white" :
                          s.type === "Regulatory" ? "bg-amber-500 text-white" :
                          "bg-purple-500 text-white"
                        )}>
                          {s.type[0]}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    <div className="text-[11px] text-slate-600 line-clamp-1 font-medium">{c.whyNow}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link to={`/accounts/${c.id}`} className="p-2 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-blue-600 transition-colors inline-block">
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
