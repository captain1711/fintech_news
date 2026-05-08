import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Building2, Bell, Target, Search, Activity, Mail, ChevronDown, Zap, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchAlerts } from "@/lib/api";
import { useState } from "react";
import { useProspectPool } from "@/context/ProspectPoolContext";
import ProspectPoolCreationModal from "../dashboard/ProspectPoolCreationModal";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/prospect-pools", label: "Prospect Pools", icon: Target },
  { to: "/signals", label: "Signals", icon: Zap },
  { to: "/accounts", label: "Accounts", icon: Building2 },
  { to: "/emails", label: "Emails", icon: Mail },
  { to: "/alerts", label: "Alerts", icon: Bell },
];

export default function AppLayout() {
  const [showPulseDropdown, setShowPulseDropdown] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { currentExecution, setSelectedProspectPoolId, setSelectedExecutionId } = useProspectPool();
  const navigate = useNavigate();

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts"],
    queryFn: fetchAlerts,
    refetchInterval: 60000,
  });

  const alertsData = Array.isArray(alerts) ? alerts : [];
  const unread = alertsData.filter((a) => a.unread).length;
  const { pathname } = useLocation();
  
  const title =
    pathname === "/" ? "Dashboard" :
    (pathname.startsWith("/prospect-pools") || pathname.startsWith("/campaigns")) ? "Prospect Pools" :
    pathname.startsWith("/signals") ? "Signals" :
    pathname.startsWith("/accounts") ? "Accounts" :
    pathname.startsWith("/emails") ? "Emails" :
    pathname.startsWith("/alerts") ? "Alerts" : "";

  return (
    <div className="min-h-screen flex w-full bg-[#f8fafc] font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 bg-[#0f172a] flex flex-col transition-all duration-300 border-r border-white/5">
        <div className="h-20 flex items-center gap-3 px-6 border-b border-white/5">
          <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div className="font-bold text-xl tracking-tight text-white">Blostem</div>
        </div>
        
        <div className="p-4 px-6 mt-4">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" /> New Prospect Pool
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 group",
                  isActive
                    ? "bg-white/10 text-white shadow-sm border border-white/5"
                    : "text-slate-400 hover:bg-white/5 hover:text-white hover:translate-x-1"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <n.icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", isActive ? "text-blue-400" : "text-slate-500 group-hover:text-blue-400")} />
                  <span className="flex-1">{n.label}</span>
                  {(n.label === "Alerts" || n.label === "Emails") && unread > 0 && (
                    <span className={cn(
                      "text-[10px] font-bold rounded-full px-2 py-1 min-w-[20px] text-center shadow-sm",
                      isActive ? "bg-blue-600 text-white" : "bg-red-500 text-white"
                    )}>
                      {unread}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-6 border-t border-white/5 bg-black/20">
          <div className="flex items-center gap-4 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group">
            <div className="h-11 w-11 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 text-white text-sm font-bold flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              AS
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-white truncate">Anirudh S.</div>
              <div className="text-[11px] text-slate-400 font-medium truncate uppercase tracking-wider">Admin Panel</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-30 flex items-center px-8 gap-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight uppercase leading-none">{title}</h1>
            {currentExecution && (
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Run: {new Date(currentExecution.execution_date).toLocaleString()}
              </span>
            )}
          </div>
          
          <div className="flex-1 max-w-xl relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <input
              placeholder="Search across prospect pools and insights..."
              className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
            />
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setShowPulseDropdown(!showPulseDropdown)}
              className="flex items-center gap-3 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors"
            >
              <span className="relative flex h-2 w-2">
                <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75", currentExecution?.status === 'running' ? "animate-ping bg-blue-500" : "bg-success")}></span>
                <span className={cn("relative inline-flex rounded-full h-2 w-2", currentExecution?.status === 'running' ? "bg-blue-600" : "bg-success")}></span>
              </span>
              <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">
                {currentExecution?.status === 'running' ? "Prospect Pool Active" : "Live Pulse"}
              </span>
              <ChevronDown className={cn("h-3 w-3 text-blue-700 transition-transform", showPulseDropdown && "rotate-180")} />
            </button>

            {showPulseDropdown && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4 animate-in fade-in zoom-in-95 duration-200">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Prospect Pool Execution Status</h4>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-success/20 text-success flex items-center justify-center shrink-0 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-success" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Articles Scanned</div>
                      <div className="text-[10px] text-muted-foreground">{currentExecution?.articles_scanned || 0} news sources analyzed</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-success/20 text-success flex items-center justify-center shrink-0 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-success" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Signals Extracted</div>
                      <div className="text-[10px] text-muted-foreground">{currentExecution?.signals_extracted || 0} strategic events found</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-blue-600" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Accounts Identified</div>
                      <div className="text-[10px] text-muted-foreground">{currentExecution?.accounts_found || 0} companies ranked</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>
        
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto pb-12">
            <Outlet />
          </div>
        </main>
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
