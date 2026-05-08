import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Calendar, Rocket, Shield, Zap, Globe, Info, Target as TargetIcon, Building } from "lucide-react";
import { createProspectPool, startProspectPoolRun } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (prospectPoolId: string, executionId: string) => void;
}

const industryOptions = ["Fintech", "BFSI", "NBFC", "Payments", "Insurtech"];
const sizeOptions = ["Startup", "Growth", "Enterprise"];
const geoOptions = ["India", "Metro-only", "Tier-2 expansion"];
const signalOptions = ["Funding", "Hiring", "Regulatory changes", "Product launches", "Partnerships"];

export default function ProspectPoolCreationModal({ isOpen, onClose, onStart }: ModalProps) {
  const [name, setName] = useState("");
  const [industries, setIndustries] = useState<string[]>(["Fintech", "Payments"]);
  const [size, setSize] = useState("Growth");
  const [geos, setGeos] = useState<string[]>(["India"]);
  const [signals, setSignals] = useState<string[]>(["Funding", "Regulatory changes"]);
  const [daysBack, setDaysBack] = useState(30);
  const [pain, setPain] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  if (!isOpen) return null;

  const handleStart = async () => {
    if (!name || !pain) {
      toast.error("Please provide a prospect pool name and pain point context.");
      return;
    }
    setLoading(true);
    try {
      const pool = await createProspectPool(name, {
        industries,
        size,
        geos,
        signals,
        pain,
        daysBack,
      });
      const run = await startProspectPoolRun(pool.id);
      toast.success("Prospect pool launched successfully!");
      queryClient.invalidateQueries({ queryKey: ["prospect-pools"] });
      queryClient.invalidateQueries({ queryKey: ["executions", pool.id] });
      onStart(pool.id, run.execution_id);
      onClose();
    } catch (error) {
      toast.error("Failed to launch prospect pool");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[40px] w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-100">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
              <TargetIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Configure Intent Strategy</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Intent Signal Intelligence Engine</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-2xl hover:bg-slate-200 text-slate-400 transition-all active:scale-90">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-8 space-y-10 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Prospect Pool Identity */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Info className="h-3 w-3" /> Prospect Pool Identity
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q2 BFSI Compliance Push"
              className="w-full h-14 rounded-2xl border border-slate-200 bg-slate-50/50 px-6 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all placeholder:text-slate-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-10">
            {/* Market Focus */}
            <div className="space-y-6">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Building className="h-3 w-3 text-blue-600" /> Target Segments (Industry)
                </label>
                <div className="flex flex-wrap gap-2">
                  {industryOptions.map(ind => (
                    <button
                      key={ind}
                      onClick={() => setIndustries(prev => prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind])}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all",
                        industries.includes(ind) ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-900/10" : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"
                      )}
                    >
                      {ind}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Globe className="h-3 w-3 text-blue-600" /> Operational Region (Geography)
                </label>
                <div className="flex flex-wrap gap-2">
                  {geoOptions.map(geo => (
                    <button
                      key={geo}
                      onClick={() => setGeos(prev => prev.includes(geo) ? prev.filter(g => g !== geo) : [...prev, geo])}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all",
                        geos.includes(geo) ? "bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/10" : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
                      )}
                    >
                      {geo}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Maturity & Intent */}
            <div className="space-y-6">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Zap className="h-3 w-3 text-amber-500" /> Intent Signal Triggers
                </label>
                <div className="flex flex-wrap gap-2">
                  {signalOptions.map(sig => (
                    <button
                      key={sig}
                      onClick={() => setSignals(prev => prev.includes(sig) ? prev.filter(s => s !== sig) : [...prev, sig])}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all",
                        signals.includes(sig) ? "bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-900/10" : "bg-white border-slate-200 text-slate-600 hover:border-amber-300"
                      )}
                    >
                      {sig}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUpIcon className="h-3 w-3 text-blue-600" /> Maturity level (Size)
                </label>
                <div className="flex gap-2">
                  {sizeOptions.map(s => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={cn(
                        "flex-1 py-1.5 rounded-xl text-[10px] font-bold border transition-all",
                        size === s ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-900/10" : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Context Engineering */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Shield className="h-3 w-3 text-blue-600" /> Pain Point / Problem Statement (LLM Context)
              </label>
              <div className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-tighter">Steers Agent Reasoning</div>
            </div>
            <textarea
              value={pain}
              onChange={(e) => setPain(e.target.value)}
              placeholder="e.g. Helping payment and fintech companies scale infrastructure while staying compliant with RBI norms."
              className="w-full h-32 rounded-3xl border border-slate-200 bg-slate-50/50 p-6 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all resize-none placeholder:text-slate-300 leading-relaxed"
            />
          </div>

          {/* Scan Parameters */}
          <div className="p-6 bg-blue-50/50 border border-blue-100 rounded-3xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Intelligence Scan Window</div>
                <div className="text-[10px] text-slate-500 font-medium">How far back should agents research?</div>
              </div>
            </div>
            <select
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
              className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </div>
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Awaiting Strategy Deployment</span>
          </div>
          <button
            onClick={handleStart}
            disabled={loading}
            className="h-14 px-10 rounded-2xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 shadow-xl shadow-blue-900/30 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
          >
            {loading ? "Allocating Agents..." : "Activate Prospect Engine"} <Rocket className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function TrendingUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  );
}
