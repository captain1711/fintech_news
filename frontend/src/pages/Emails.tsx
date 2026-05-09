import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchOutreach,
  fetchContacts,
  generateOutreachSequence,
  saveOutreachSequence,
} from "@/lib/api";
import { useProspectPool } from "@/context/ProspectPoolContext";
import type { Account, Contact, OutreachSequenceStep } from "@/types/api";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Search,
  User,
  Mail,
  Loader2,
  CheckCircle2,
  Zap,
  Clock,
  RefreshCw,
  Save,
  ChevronRight,
  Linkedin,
  MapPin,
  ExternalLink,
  Phone,
  Filter,
  Pencil,
} from "lucide-react";
import { PriorityBadge } from "@/components/dashboard/PriorityBadge";

const ROLE_OPTIONS = [
  "Head of Partnerships",
  "VP Product",
  "CTO",
  "CEO",
  "Compliance Head",
];

type SequenceState = Record<string, OutreachSequenceStep[]>;

export default function Emails() {
  const { 
    prospectPools, 
    selectedProspectPoolId, 
    setSelectedProspectPoolId,
    executions,
    selectedExecutionId,
    setSelectedExecutionId 
  } = useProspectPool();

  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState(ROLE_OPTIONS[0]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [sequenceDrafts, setSequenceDrafts] = useState<SequenceState>({});
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [pendingSequenceSave, setPendingSequenceSave] = useState<{
    accountId: string;
    sequence: OutreachSequenceStep[];
  } | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());

  const {
    data: outreach = [],
    isLoading: isAccountsLoading,
  } = useQuery({
    queryKey: ["outreach", selectedExecutionId],
    queryFn: () => fetchOutreach(selectedExecutionId),
    enabled: !!selectedExecutionId,
  });

  const sortedOutreach = useMemo(() => {
    return [...outreach].sort((a, b) => b.score - a.score);
  }, [outreach]);

  const filteredAccounts = useMemo(() => {
    if (!search.trim()) return sortedOutreach;
    return sortedOutreach.filter((account) =>
      account.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [sortedOutreach, search]);

  const currentAccount = useMemo(() => {
    if (!selectedAccountId) return undefined;
    return outreach.find((acc) => acc.id === selectedAccountId);
  }, [outreach, selectedAccountId]);

  const {
    data: contactsData,
    isFetching: isContactsLoading,
    refetch: refetchContacts,
  } = useQuery({
    queryKey: [
      "contacts",
      selectedProspectPoolId,
      selectedExecutionId,
      selectedAccountId,
      selectedRole,
    ],
    queryFn: () =>
      fetchContacts(
        selectedProspectPoolId!,
        selectedExecutionId!,
        selectedAccountId!,
        selectedRole,
      ),
    enabled: false,
    retry: false,
  });

  const contacts: Contact[] = contactsData?.contacts ?? [];

  useEffect(() => {
    if (contacts.length > 0 && !selectedLeadId) {
      setSelectedLeadId(contacts[0].id);
    }
  }, [contacts, selectedLeadId]);

  useEffect(() => {
    setSelectedLeadId(null);
  }, [selectedAccountId, selectedRole]);

  const activeLead = contacts.find((c) => c.id === selectedLeadId) || currentAccount?.selectedLead?.lead || null;

  const currentSequence = useMemo(() => {
    if (!selectedAccountId) return [];
    return sequenceDrafts[selectedAccountId] || currentAccount?.outreachSequence || [];
  }, [selectedAccountId, sequenceDrafts, currentAccount]);
  const topSignals = currentAccount?.signals?.slice(0, 3) ?? [];

  const generateSequenceMutation = useMutation({
    mutationFn: ({ lead, accountId }: { lead: Contact; accountId: string }) =>
      generateOutreachSequence(selectedProspectPoolId!, selectedExecutionId!, accountId, {
        role: selectedRole,
        lead,
      }),
    onSuccess: (data, variables) => {
      setSequenceDrafts((prev) => ({
        ...prev,
        [variables.accountId]: data.sequence,
      }));
      toast.success("Sequence generated successfully");
    },
  });

  const saveSequenceMutation = useMutation({
    mutationFn: ({ accountId, sequence }: { accountId: string; sequence: OutreachSequenceStep[] }) =>
      saveOutreachSequence(selectedProspectPoolId!, selectedExecutionId!, accountId, sequence),
    onSuccess: (data, variables) => {
      setSequenceDrafts((prev) => ({
        ...prev,
        [variables.accountId]: data.sequence,
      }));
    },
    onError: () => {
      toast.error("Unable to save sequence edits");
    },
  });

  useEffect(() => {
    if (!pendingSequenceSave || !selectedProspectPoolId || !selectedExecutionId) return;

    const timeout = window.setTimeout(() => {
      saveSequenceMutation.mutate(pendingSequenceSave);
      setPendingSequenceSave(null);
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [pendingSequenceSave, selectedProspectPoolId, selectedExecutionId]);

  const toggleAccountSelection = (id: string) => {
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleFetchContacts = async () => {
    if (!selectedAccountId || !selectedExecutionId || !selectedProspectPoolId) return;

    const result = await refetchContacts();
    if (result.error) {
      toast.error("Unable to fetch contacts from RocketReach");
      return;
    }

    const fetchedContacts = result.data?.contacts ?? [];
    if (fetchedContacts.length === 0) {
      toast.info("No contacts found for this company and role");
      return;
    }

    setSelectedLeadId(fetchedContacts[0].id);
    toast.success("Contacts fetched");
  };

  const updateSequenceStep = (idx: number, updates: Partial<OutreachSequenceStep>) => {
    if (!selectedAccountId) return;

    const nextSequence = currentSequence.map((step, stepIdx) => (
      stepIdx === idx ? { ...step, ...updates } : step
    ));

    setSequenceDrafts((prev) => ({
      ...prev,
      [selectedAccountId]: nextSequence,
    }));
    setPendingSequenceSave({
      accountId: selectedAccountId,
      sequence: nextSequence,
    });
  };

  return (
    <div className="px-8 py-6 bg-slate-50 min-h-screen">
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_320px]">
      {/* Sidebar - Account List */}
      <aside className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col">
        <div className="p-4 border-b border-slate-200 space-y-4 rounded-t-3xl">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <h1 className="font-bold text-slate-900 tracking-tight">Outreach Lab</h1>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <span>Prospect Pool</span>
            </div>
            <select 
              value={selectedProspectPoolId}
              onChange={(e) => setSelectedProspectPoolId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
            >
              {prospectPools.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest">
              <span>Execution</span>
            </div>
            <select 
              value={selectedExecutionId}
              onChange={(e) => setSelectedExecutionId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
            >
              {executions.map(e => (
                <option key={e.id} value={e.id}>{new Date(e.execution_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {isAccountsLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest">Syncing Intelligence</span>
            </div>
          ) : filteredAccounts.map(account => (
            <div 
              key={account.id}
              onClick={() => setSelectedAccountId(account.id)}
              className={cn(
                "group flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden",
                selectedAccountId === account.id ? "bg-blue-600 border-blue-600 shadow-lg shadow-blue-200" : "bg-white border-slate-100 hover:border-blue-200"
              )}
            >
              <div className="relative flex items-center shrink-0">
                <input 
                  type="checkbox"
                  checked={selectedAccounts.has(account.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleAccountSelection(account.id);
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className={cn("text-sm font-bold truncate", selectedAccountId === account.id ? "text-white" : "text-slate-900")}>
                  {account.name}
                </div>
                <div className={cn("text-[10px] font-bold uppercase tracking-widest truncate mt-0.5", selectedAccountId === account.id ? "text-blue-100" : "text-slate-400")}>
                  {account.industry}
                </div>
              </div>
              <div className="flex flex-col items-end shrink-0 gap-1">
                <PriorityBadge priority={account.priority} />
                <div className={cn("text-[10px] font-black", selectedAccountId === account.id ? "text-blue-100" : "text-slate-400")}>
                  {account.score}
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content - Sequence Editor */}
      <main className="flex flex-col min-w-0 bg-white border border-slate-200 rounded-3xl shadow-sm">
        <header className="h-16 px-6 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="font-bold text-slate-900 truncate max-w-[200px]">
              {currentAccount?.name || "Select an account"}
            </h2>
            {currentAccount && (
              <div className="flex bg-slate-100 rounded-full p-1 border border-slate-200">
                {ROLE_OPTIONS.map(role => (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all",
                      selectedRole === role ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {role}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleFetchContacts}
              disabled={!selectedAccountId || !selectedExecutionId || !selectedProspectPoolId || isContactsLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all border border-slate-100 text-xs font-bold disabled:opacity-50"
              title="Fetch RocketReach contacts for the selected company and role"
            >
              <RefreshCw className={cn("h-3 w-3", isContactsLoading && "animate-spin")} />
              Fetch Contact
            </button>
            <button 
              onClick={() => {
                if (activeLead && selectedAccountId) {
                  generateSequenceMutation.mutate({ lead: activeLead, accountId: selectedAccountId });
                }
              }}
              disabled={!activeLead || generateSequenceMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-50 transition-all"
            >
              {generateSequenceMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              Generate Sequence
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          <div className="max-w-3xl mx-auto space-y-8">
            {currentSequence.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-4 border-2 border-dashed border-slate-100 rounded-[32px]">
                <div className="h-16 w-16 rounded-3xl bg-slate-50 flex items-center justify-center">
                  <Mail className="h-8 w-8 opacity-20" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No Sequence Drafted</p>
                  <p className="text-xs font-medium text-slate-400 mt-1">Select a lead and click Generate Sequence</p>
                </div>
              </div>
            ) : (
              <div className="space-y-0">
                {currentSequence.map((step, idx) => (
                  <div key={idx} className="animate-fade-in" style={{ animationDelay: `${idx * 0.1}s` }}>
                    {idx > 0 && (
                      <div className="flex items-center gap-4 py-6">
                        <div className="h-px flex-1 bg-slate-200" />
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          <Clock className="h-3 w-3" />
                          Wait {step.wait_days || step.waitDays} days
                        </div>
                        <div className="h-px flex-1 bg-slate-200" />
                      </div>
                    )}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="h-6 w-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black">
                            {idx + 1}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email {idx + 1}</span>
                            <div className="text-sm font-bold text-slate-900">{step.subject}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-[10px] font-bold text-slate-400">
                            {idx === 0 ? "Send now" : `Follow-up ${idx}`}
                          </div>
                          <button
                            onClick={() => setEditingStepIndex(editingStepIndex === idx ? null : idx)}
                            className={cn(
                              "h-8 w-8 rounded-lg border flex items-center justify-center transition-colors",
                              editingStepIndex === idx
                                ? "border-blue-200 bg-blue-50 text-blue-600"
                                : "border-slate-200 bg-white text-slate-400 hover:text-blue-600 hover:border-blue-200"
                            )}
                            title="Edit email"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="p-6">
                        {editingStepIndex === idx ? (
                          <div className="space-y-4">
                            <div>
                              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Subject
                              </label>
                              <input
                                value={step.subject}
                                onChange={(event) => updateSequenceStep(idx, { subject: event.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                              />
                            </div>
                            <div>
                              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Body
                              </label>
                              <textarea
                                value={step.body}
                                onChange={(event) => updateSequenceStep(idx, { body: event.target.value })}
                                rows={10}
                                className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium leading-relaxed text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                              />
                              <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {saveSequenceMutation.isPending ? "Saving edits" : "Autosaved"}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="mb-4 text-sm font-bold text-slate-900">
                              Subject: {step.subject}
                            </div>
                            <div className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">
                              {step.body}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Details Panel - Lead Info */}
      <aside className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 flex items-center gap-2">
            <Filter className="h-3 w-3" /> Available Leads
          </div>
          
          <div className="space-y-3">
            {isContactsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                ))}
              </div>
            ) : contacts.map(contact => (
              <div 
                key={contact.id}
                onClick={() => setSelectedLeadId(contact.id)}
                className={cn(
                  "p-4 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden",
                  selectedLeadId === contact.id ? "bg-white border-blue-200 shadow-md ring-2 ring-blue-50" : "bg-white border-slate-100 hover:border-blue-100"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 truncate">{contact.name}</div>
                    <div className="text-[10px] font-semibold text-slate-500 truncate mt-0.5">{contact.title}</div>
                  </div>
                  {contact.email && (
                    contact.email_verified || contact.emailVerified ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 ml-2" />
                    ) : (
                      <Mail className="h-3.5 w-3.5 text-amber-500 shrink-0 ml-2" />
                    )
                  )}
                </div>
              </div>
            ))}
          </div>

          {activeLead && (
            <div className="pt-6 border-t border-slate-200 space-y-6">
              <div className="space-y-4">
                <div className="flex flex-col items-center text-center">
                  <div className="h-20 w-20 rounded-3xl bg-white border border-slate-200 flex items-center justify-center shadow-sm relative overflow-hidden mb-3">
                    <User className="h-10 w-10 text-slate-200" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/5 to-transparent" />
                  </div>
                  <h3 className="font-bold text-slate-900 leading-tight">{activeLead.name}</h3>
                  <p className="text-[11px] font-semibold text-slate-500 mt-1">{activeLead.title}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                    {activeLead.source || "RocketReach"} data
                  </p>
                </div>

                <div className="space-y-2">
                  {activeLead.linkedin && (
                    <a 
                      href={activeLead.linkedin} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all text-xs group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                          <Linkedin className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-slate-600">LinkedIn Profile</span>
                      </div>
                      <ExternalLink className="h-3 w-3 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </a>
                  )}

                  {activeLead.email && (
                    <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-7 w-7 rounded-lg flex items-center justify-center",
                          activeLead.email_verified || activeLead.emailVerified ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                        )}>
                          <Mail className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Email
                          </span>
                          <span className="font-bold text-slate-700 truncate max-w-[150px]">{activeLead.email}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeLead.location && (
                    <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</span>
                          <span className="font-bold text-slate-700">{activeLead.location}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeLead.phone && (
                    <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                          <Phone className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</span>
                          <span className="font-bold text-slate-700">{activeLead.phone}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {currentAccount && (
                  <div className="space-y-3 pt-5 border-t border-slate-100">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Why now</p>
                      <p className="text-sm text-slate-600">{currentAccount.whyNow}</p>
                    </div>
                    {topSignals.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Key signals</p>
                        <ul className="space-y-2">
                          {topSignals.map((signal) => (
                            <li key={signal.id} className="text-xs text-slate-600 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                              <span className="font-semibold text-slate-800">{signal.type}</span>
                              <span className="text-slate-500"> — {signal.description}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
      </div>
    </div>
  );
}
