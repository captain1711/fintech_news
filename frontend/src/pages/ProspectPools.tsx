import { useState } from "react";
import { Rocket, Plus, ChevronRight, Globe, Zap, Clock, Activity, ArrowRight, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProspectPool } from "@/context/ProspectPoolContext";
import { useNavigate } from "react-router-dom";
import ProspectPoolCreationModal from "@/components/dashboard/ProspectPoolCreationModal";

export default function ProspectPools() {
  const { 
    prospectPools, 
    selectedProspectPoolId, 
    setSelectedProspectPoolId, 
    setSelectedExecutionId,
    executions 
  } = useProspectPool();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  const activePool = prospectPools.find(p => p.id === selectedProspectPoolId) || prospectPools[0];

  const handleViewResults = (executionId: string) => {
    setSelectedExecutionId(executionId);
    navigate("/");
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden">
      {/* Prospect Pool List Sidebar */}
      <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Your Prospect Pools</h2>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-blue-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {prospectPools.map(pool => (
            <button
              key={pool.id}
              onClick={() => setSelectedProspectPoolId(pool.id)}
              className={cn(
                "w-full text-left p-4 rounded-2xl transition-all border group",
                selectedProspectPoolId === pool.id 
                  ? "bg-slate-900 border-slate-900 shadow-xl shadow-slate-900/20" 
                  : "bg-white border-slate-100 hover:border-blue-200"
              )}
            >
              <div className={cn("text-xs font-bold uppercase tracking-widest mb-1", selectedProspectPoolId === pool.id ? "text-slate-400" : "text-slate-400")}>
                Created {new Date(pool.created_at).toLocaleDateString()}
              </div>
              <div className={cn("font-bold text-sm", selectedProspectPoolId === pool.id ? "text-white" : "text-slate-900")}>
                {pool.name}
              </div>
              <div className={cn("mt-3 flex items-center gap-2", selectedProspectPoolId === pool.id ? "text-slate-500" : "text-slate-400")}>
                <Globe className="h-3 w-3" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{pool.icp.industries[0]} Focus</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Execution History Area */}
      <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-slate-900">{activePool?.name}</h1>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest border border-blue-200">
                  Targeting Active
                </span>
              </div>
              <p className="text-sm text-slate-500 font-medium">History of intelligence searches and executions for this prospect pool.</p>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="h-11 px-6 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20"
            >
              <Rocket className="h-4 w-4" /> Start New Search
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Execution History</h3>
            
            {executions.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 flex flex-col items-center text-center space-y-3">
                <Clock className="h-8 w-8 text-slate-200" />
                <div className="text-sm font-bold text-slate-900">No executions found</div>
                <p className="text-xs text-slate-500 max-w-xs">Start a prospect pool run to begin gathering signals and identifying target accounts.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {executions.map((exec, idx) => (
                  <div key={exec.id} className="bg-white border border-slate-200 rounded-3xl p-6 hover:shadow-md transition-all group">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                          <Activity className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">Execution #{executions.length - idx}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {new Date(exec.execution_date).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <div className="text-lg font-bold text-slate-900">{exec.articles_scanned}</div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase">Articles</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">{exec.signals_extracted}</div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase">Signals</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-success">{exec.accounts_found}</div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase">Accounts</div>
                        </div>
                        <button 
                          onClick={() => handleViewResults(exec.id)}
                          className="ml-4 h-10 px-6 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-2"
                        >
                          View Results <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-50">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                        <BarChart3 className="h-3 w-3" /> Status: <span className="text-success">{exec.status}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                        <Zap className="h-3 w-3" /> Logic: Signal Extraction + Scored
                      </div>
                      <div className="flex items-center justify-end gap-1 text-blue-600 font-bold text-[10px] uppercase">
                        Browse full dataset <ChevronRight className="h-3 w-3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ProspectPoolCreationModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onStart={(cid, eid) => {
          setSelectedProspectPoolId(cid);
          setSelectedExecutionId(eid);
          navigate("/");
        }}
      />
    </div>
  );
}
