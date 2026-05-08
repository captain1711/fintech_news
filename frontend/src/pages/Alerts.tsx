import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchAlerts, subscribeToAlerts } from "@/lib/api";
import { AlertTriangle, Bell, Check, Clock, Mail, Shield, TrendingUp, Zap } from "lucide-react";
import type { Alert } from "@/types/api";
import { cn } from "@/lib/utils";

export default function Alerts() {
  const [email, setEmail] = useState("");
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: fetchAlerts,
    refetchInterval: 60_000,
  });

  const subscribeMutation = useMutation({
    mutationFn: subscribeToAlerts,
    onSuccess: (res) => {
      const status = res.status;
      if (status === "subscribed") {
        toast.success("Subscribed! Welcome email on the way.");
      } else {
        toast.info("You're already on the alerts list.");
      }
      setEmail("");
    },
    onError: () => toast.error("Unable to subscribe right now. Please try again."),
  });

  const topAlerts = useMemo(() => alerts.slice(0, 6), [alerts]);

  const handleSubscribe = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Enter an email to subscribe.");
      return;
    }
    subscribeMutation.mutate(trimmed);
  };

  return (
    <div className="px-8 py-10 space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="bg-[#0f172a] text-white rounded-3xl p-8 space-y-6 shadow-2xl shadow-blue-900/20">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-blue-500 flex items-center justify-center">
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Fintech Pulse</p>
              <h1 className="text-2xl font-bold mt-1">Hourly alerts for banking & payments</h1>
            </div>
          </div>
          <p className="text-sm text-blue-100 leading-relaxed">
            Every hour Blostem scans fintech & banking news, scores the highest-intent companies, and surfaces the
            strongest “why now” signals. Subscribe to receive the ranked digest straight to your inbox.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-4">
            {[
              { label: "Cadence", value: "Every hour", icon: Clock },
              { label: "Coverage", value: "Fintech · Payments · BFSI", icon: Shield },
              { label: "Signals", value: "Funding · Regulatory · Product", icon: Zap },
            ].map((item) => (
              <div key={item.label} className="bg-white/5 rounded-2xl p-3 border border-white/10">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-200 uppercase tracking-widest">
                  <item.icon className="h-3.5 w-3.5 text-blue-100" />
                  {item.label}
                </div>
                <p className="text-sm font-bold mt-2">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
        <form
          onSubmit={handleSubscribe}
          className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col gap-4"
        >
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-500" />
              Subscribe to alerts
            </p>
            <h2 className="text-lg font-semibold text-slate-900 mt-2">Get the digest in your inbox</h2>
            <p className="text-sm text-slate-500">
              First email is a welcome note. After that you’ll receive the hourly pulse with the top-ranked accounts.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full h-12 px-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={subscribeMutation.isPending}
            className="h-12 rounded-2xl bg-blue-600 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 disabled:opacity-50"
          >
            {subscribeMutation.isPending ? "Subscribing..." : "Start hourly alerts"}
          </button>
          <p className="text-[11px] text-slate-400">
            We’ll only use this email for alerts. Reply “STOP” to unsubscribe anytime.
          </p>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Latest alert run</h3>
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {alerts[0]?.time ? new Date(alerts[0].time).toLocaleString() : "waiting for first scan"}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading && topAlerts.length === 0 && (
            [...Array(3)].map((_, idx) => (
              <div
                key={idx}
                className="h-40 rounded-3xl border border-slate-100 bg-white animate-pulse"
              />
            ))
          )}
          {!isLoading && topAlerts.length === 0 && (
            <div className="col-span-full bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-3">
              <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">
                Hourly scan hasn’t completed yet. Check back in a minute.
              </p>
            </div>
          )}
          {topAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      </section>
    </div>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-lg transition-all flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Account</p>
          <h4 className="text-lg font-semibold text-slate-900">{alert.companyName}</h4>
        </div>
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest",
            alert.intentScore >= 80
              ? "bg-red-50 text-red-600"
              : alert.intentScore >= 60
                ? "bg-amber-50 text-amber-600"
                : "bg-slate-100 text-slate-500",
          )}
        >
          Score {alert.intentScore ?? 0}
        </span>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">{alert.signal}</p>
      <div className="flex items-center justify-between text-[11px] font-semibold">
        <span className="flex items-center gap-1 text-slate-500">
          <TrendingUp className="h-3.5 w-3.5 text-blue-500" /> {alert.signalType}
        </span>
        <span className="flex items-center gap-1 text-slate-400 uppercase tracking-widest">
          <Check className="h-3 w-3 text-green-500" /> Live
        </span>
      </div>
    </div>
  );
}
