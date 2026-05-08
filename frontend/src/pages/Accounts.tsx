import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAccounts, fetchDeepReview, fetchExecutionStatus } from "@/lib/api";
import { 
  Building2, Search, Filter, ArrowUpRight, TrendingUp, 
  MapPin, Calendar, Globe, Zap, Shield, ChevronRight, 
  X, Loader2, Info, CheckCircle2, MessageSquare, ExternalLink
} from "lucide-react";
import { PriorityBadge, ScoreBar } from "@/components/dashboard/PriorityBadge";
import { cn } from "@/lib/utils";
import { useProspectPool } from "@/context/ProspectPoolContext";

export default function Accounts() {
  const { selectedProspectPoolId, selectedExecutionId } = useProspectPool();
  const [search, setSearch] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const { data: executionStatus } = useQuery({
    queryKey: ["execution-status", selectedProspectPoolId, selectedExecutionId, "accounts"],
    queryFn: () => fetchExecutionStatus(selectedProspectPoolId, selectedExecutionId),
    enabled: !!selectedExecutionId && !!selectedProspectPoolId,
    refetchInterval: (query) => query.state.data?.isRunning ? 3000 : false,
  });

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts", selectedProspectPoolId, selectedExecutionId],
    queryFn: () => fetchAccounts(selectedProspectPoolId, selectedExecutionId),
    enabled: !!selectedExecutionId && !!selectedProspectPoolId,
    refetchInterval: executionStatus?.isRunning ? 2000 : false,
  });

  const filtered = accounts.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.industry.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="px-8 py-6 space-y-8 relative min-h-screen">
      {/* Header & Search */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Identified Accounts</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">High-intent companies detected in prospect pool run {selectedExecutionId.slice(0,8)}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search companies..." 
              className="w-full h-12 pl-12 pr-4 bg-white border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-blue-100 transition-all shadow-sm" 
            />
          </div>
          <button className="p-3 border border-slate-200 bg-white rounded-2xl hover:bg-slate-50 transition-all shadow-sm">
            <Filter className="h-5 w-5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(acc => (
          <div 
            key={acc.id} 
            onClick={() => setSelectedAccountId(acc.id)}
            className="group bg-white border border-slate-200 rounded-[32px] p-6 hover:shadow-2xl hover:shadow-blue-900/10 transition-all cursor-pointer relative overflow-hidden"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 text-xl font-black group-hover:scale-110 transition-transform">
                {acc.name[0]}
              </div>
              <PriorityBadge priority={acc.priority} />
            </div>
            
            <div className="space-y-1 mb-6">
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{acc.name}</h3>
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {acc.industry} · {acc.size}
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-50">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Intent Score</span>
                <span className="text-xs font-bold text-blue-600">{acc.score}%</span>
              </div>
              <ScoreBar score={acc.score} segments />
            </div>

            <div className="mt-6 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-amber-500" /> {acc.signalsCount} Signals
              </div>
              <div className="flex items-center gap-1.5 group-hover:text-blue-600 transition-colors">
                Deep Review <ArrowUpRight className="h-3 w-3" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Full Page Review Overlay */}
      {selectedAccountId && selectedProspectPoolId && (
        <DeepReviewOverlay 
          accountId={selectedAccountId} 
          prospectPoolId={selectedProspectPoolId}
          executionId={selectedExecutionId}
          onClose={() => setSelectedAccountId(null)} 
        />
      )}
    </div>
  );
}

function DeepReviewOverlay({ accountId, prospectPoolId, executionId, onClose }: { accountId: string, prospectPoolId: string, executionId: string, onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["deep-review", accountId, executionId],
    queryFn: () => fetchDeepReview(prospectPoolId, executionId, accountId),
  });

  if (!data && isLoading) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-8">
        <div className="bg-white rounded-[40px] p-12 flex flex-col items-center gap-6 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="h-20 w-20 rounded-full border-4 border-blue-50 border-t-blue-600 animate-spin" />
          <div className="text-center">
            <h3 className="text-xl font-bold text-slate-900">Activating Deep Review Agents</h3>
            <p className="text-sm text-slate-500 mt-2">Scraping website and correlating market signals...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { account, review } = data;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xl flex justify-end animate-in fade-in duration-300">
      <div className="w-full max-w-5xl bg-[#f8fafc] h-screen overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-500 relative">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-8 right-8 z-10 p-3 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 shadow-sm transition-all hover:rotate-90"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Hero Section */}
        <div className="bg-white border-b border-slate-200 p-12 pt-16">
          <div className="max-w-4xl mx-auto space-y-10">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-8">
                <div className="h-24 w-24 rounded-[32px] bg-slate-50 flex items-center justify-center text-slate-400 text-4xl font-black shadow-inner">
                  {account.name[0]}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">{account.name}</h1>
                    <PriorityBadge priority={account.priority} />
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-blue-600" /> {account.domain}</span>
                    <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-blue-600" /> {review.headquarters || "Global"}</span>
                    <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-blue-600" /> Founded {review.founding_year || "Unknown"}</span>
                  </div>
                </div>
              </div>
              <div className="text-right space-y-2">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Intent Convergence</div>
                <div className="text-6xl font-black text-blue-600 leading-none">{account.score}<span className="text-2xl">%</span></div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-6">
              {[
                { label: "Detected Signals", value: account.signalsCount, icon: Zap, color: "text-amber-500" },
                { label: "Product Synergy", value: "High", icon: Shield, color: "text-blue-600" },
                { label: "GTM Readiness", value: "Immediate", icon: TrendingUp, color: "text-success" },
                { label: "Agent Confidence", value: "98%", icon: CheckCircle2, color: "text-blue-600" },
              ].map(stat => (
                <div key={stat.label} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <stat.icon className={cn("h-3.5 w-3.5", stat.color)} />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                  </div>
                  <div className="text-lg font-bold text-slate-900">{stat.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-12 py-16 space-y-16">
          {/* Why Now Section - The Most Important Part */}
          <section className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="h-1 w-12 bg-blue-600 rounded-full" />
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight italic">Why Now? — Strategic Intelligence</h2>
            </div>
            
            <div className="bg-white border-2 border-blue-600/10 rounded-[40px] p-10 shadow-xl shadow-blue-900/5 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                  <TrendingUp className="h-48 w-48 text-blue-600 rotate-12" />
               </div>
               <div className="relative z-10 space-y-6">
                  <p className="text-xl font-bold text-slate-800 leading-relaxed italic">
                    "{review.why_now_reasoning || "Analyzing strategic alignment..."}"
                  </p>
                  <div className="flex items-center gap-3 pt-6 border-t border-slate-100">
                    <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">B</div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-widest text-slate-900">Blostem Strategic Agent</div>
                      <div className="text-[10px] font-bold text-slate-400">Context: {account.whyNow}</div>
                    </div>
                  </div>
               </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-12">
            {/* Company Details */}
            <section className="space-y-6">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600" /> Core Infrastructure
              </h3>
              <p className="text-sm text-slate-600 font-medium leading-relaxed">
                {review.detailed_description || "Company description loading from deep scrape..."}
              </p>
              <div className="space-y-3 pt-4">
                 <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Key Offerings</h4>
                 <div className="flex flex-wrap gap-2">
                    {review.key_products?.map((p: string) => (
                      <span key={p} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-bold text-slate-600">{p}</span>
                    ))}
                 </div>
              </div>
            </section>

            {/* Signal Timeline */}
            <section className="space-y-6">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" /> Recent Strategic Shifts
              </h3>
              <div className="space-y-4">
                {account.signals.map((sig: any, idx: number) => (
                  <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 relative overflow-hidden group/sig">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 opacity-20 group-hover/sig:opacity-100 transition-opacity" />
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{sig.type}</span>
                      <span className="text-[9px] font-bold text-slate-400">{sig.date}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 leading-snug">{sig.description}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Action Footer */}
          <div className="pt-12 border-t border-slate-200 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <a 
                  href={`https://${account.domain}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" /> Visit Website
                </a>
                <button className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors">
                  <MessageSquare className="h-4 w-4" /> Agent Reasoning
                </button>
             </div>
             <button className="h-14 px-10 rounded-2xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 shadow-xl shadow-blue-900/30 transition-all flex items-center gap-3">
                Prepare Personalized Outreach <ChevronRight className="h-5 w-5" />
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
