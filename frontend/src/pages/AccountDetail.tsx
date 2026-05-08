import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { 
  ArrowLeft, Sparkles, Mail, Linkedin, Copy, Check, 
  Calendar, Banknote, Users, FileText, Megaphone, 
  Handshake, Zap, Target, MessageSquare
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchAccount } from "@/lib/api";
import { PriorityBadge } from "@/components/dashboard/PriorityBadge";
import { useProspectPool } from "@/context/ProspectPoolContext";

const iconBySignal: Record<string, any> = {
  Funding: Banknote,
  Hiring: Users,
  Regulatory: FileText,
  "Product Launch": Megaphone,
  Partnership: Handshake,
  Strategic: Handshake,
  Modernization: Sparkles,
  Compliance: FileText,
};

export default function AccountDetail() {
  const { id } = useParams();
  const { selectedProspectPoolId, selectedExecutionId } = useProspectPool();
  
  const { data: company, isLoading, isError } = useQuery({
    queryKey: ["account", id, selectedProspectPoolId, selectedExecutionId],
    queryFn: () => fetchAccount(selectedProspectPoolId, selectedExecutionId, id ?? ""),
    enabled: Boolean(id && selectedProspectPoolId && selectedExecutionId),
  });

  const [draft, setDraft] = useState("");
  
  useEffect(() => {
    if (company) {
      setDraft(company.outreachDraft || "");
    }
  }, [company]);

  const [copied, setCopied] = useState(false);
  const [channel, setChannel] = useState<"email" | "linkedin">("email");

  if (isLoading || !company) {
    return (
      <div className="flex flex-col items-center justify-center h-screen space-y-4">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        <p className="text-sm text-muted-foreground">
          {isError ? "Unable to load account. Please try again." : "Fetching account intelligence..."}
        </p>
      </div>
    );
  }

  const copy = async () => {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        
        {/* Navigation */}
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors group">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Back to Signal Pipeline
        </Link>

        {/* Header Section */}
        <header className="relative overflow-hidden rounded-2xl border border-border bg-card/50 backdrop-blur-md p-8 shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-3xl -z-10 rounded-full translate-x-1/2 -translate-y-1/2" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <h1 className="text-4xl font-bold tracking-tight">{company.name}</h1>
                <PriorityBadge priority={company.priority} />
              </div>
              <p className="text-lg text-muted-foreground font-medium">
                {company.domain} • {company.industry} • {company.size}
              </p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Intent Score</span>
              <div className="flex items-baseline gap-1">
                <span className="text-6xl font-black text-primary tabular-nums tracking-tighter">
                  {company.score}
                </span>
                <span className="text-xl font-bold text-muted-foreground">/100</span>
              </div>
            </div>
          </div>
        </header>

        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* Main Content Area (8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* AI Insight Block */}
            <section className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-secondary/50 rounded-2xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className="relative rounded-2xl border border-primary/20 bg-primary/5 p-6 space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="h-5 w-5 animate-pulse" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">AI Intent Insight</h3>
                </div>
                <p className="text-lg leading-relaxed font-medium">
                  {company.aiInsight}
                </p>
              </div>
            </section>

            {/* Signals Timeline */}
            <section className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Signals Timeline</h3>
                </div>
                <span className="text-xs font-bold bg-muted px-2 py-1 rounded-full text-muted-foreground uppercase">
                  {company.signals.length} Events
                </span>
              </div>
              <div className="p-6">
                <div className="relative space-y-6 before:absolute before:inset-0 before:ml-4 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-primary/50 before:via-border before:to-transparent">
                  {company.signals.map((s, idx) => {
                    const Icon = iconBySignal[s.type] || Zap;
                    return (
                      <div key={s.id} className="relative flex items-start gap-6 group">
                        <div className="absolute left-0 mt-1 h-8 w-8 rounded-full border-4 border-background bg-primary flex items-center justify-center z-10 shadow-lg group-hover:scale-110 transition-transform">
                          <Icon className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                        <div className="flex-1 ml-4 pt-0.5">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-sm font-bold text-foreground">{s.type}</span>
                            <span className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {s.date}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {s.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Outreach Draft Section */}
            <section className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Outreach Draft</h3>
                </div>
                <div className="flex bg-muted p-1 rounded-lg">
                  <button
                    onClick={() => setChannel("email")}
                    className={`text-[10px] uppercase font-bold px-3 py-1 rounded-md transition-all ${channel === "email" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Email
                  </button>
                  <button
                    onClick={() => setChannel("linkedin")}
                    className={`text-[10px] uppercase font-bold px-3 py-1 rounded-md transition-all ${channel === "linkedin" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    LinkedIn
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="relative">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={8}
                    className="w-full text-sm font-mono border border-border rounded-xl p-4 bg-muted/10 focus:ring-2 focus:ring-primary/20 outline-none transition-all leading-relaxed"
                  />
                  <div className="absolute top-2 right-2">
                    {channel === "email" ? <Mail className="h-4 w-4 text-muted-foreground/30" /> : <Linkedin className="h-4 w-4 text-muted-foreground/30" />}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[11px] text-muted-foreground">
                    AI-generated based on recent funding and modernization signals.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={copy}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-xs font-bold hover:bg-muted transition-colors"
                    >
                      {copied ? <><Check className="h-3.5 w-3.5 text-green-500" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy Text</>}
                    </button>
                    <button className="inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:shadow-lg hover:shadow-primary/20 transition-all">
                      <Zap className="h-3.5 w-3.5" /> Send Outreach
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar Area (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Suggested Action Card */}
            <section className="rounded-2xl bg-foreground text-background p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Target className="h-24 w-24" />
              </div>
              <div className="relative space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <Target className="h-5 w-5" />
                  <h3 className="text-xs font-bold uppercase tracking-widest">Suggested Action</h3>
                </div>
                <p className="text-lg font-bold leading-tight">
                  {company.suggestedAction}
                </p>
                <button className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-wider hover:scale-[1.02] active:scale-95 transition-all">
                  Execute Strategy
                </button>
              </div>
            </section>

            {/* Why Now Card */}
            <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Contextual Urgency</h3>
              <p className="text-sm font-medium leading-relaxed italic">
                "{company.whyNow}"
              </p>
            </section>

            {/* Details Table */}
            <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Account Summary</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-xs font-medium text-muted-foreground">Target Industry</span>
                  <span className="text-xs font-bold">{company.industry}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-xs font-medium text-muted-foreground">Tier</span>
                  <span className="text-xs font-bold">{company.size}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-xs font-medium text-muted-foreground">Detected Signals</span>
                  <span className="text-xs font-bold text-primary">{company.signalsCount}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs font-medium text-muted-foreground">Last Crawl</span>
                  <span className="text-xs font-bold">{company.lastActivity}</span>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
