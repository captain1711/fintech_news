export type Priority = "Hot" | "Warm" | "Cold";
export type SignalType =
  | "Funding"
  | "Hiring"
  | "Regulatory"
  | "Product Launch"
  | "Partnership"
  | "Modernization"
  | "Compliance";

export interface Signal {
  id: string;
  type: SignalType | string;
  description: string;
  date: string;
  intentScore?: number;
}

export interface Contact {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  title: string;
  role?: string;
  company: string;
  email?: string;
  email_verified?: boolean;
  emailVerified?: boolean;
  linkedin?: string;
  location?: string;
  phone?: string;
  status?: string;
  source?: string;
}

export interface SelectedLead {
  lead: Contact;
  role: string;
}

export interface OutreachSequenceStep {
  step: number;
  subject: string;
  body: string;
  wait_days?: number;
  waitDays?: number;
}

export interface Account {
  id: string;
  prospectPoolId: string;
  executionId: string;
  name: string;
  domain: string;
  industry: string;
  size: string;
  score: number;
  priority: Priority;
  signalsCount: number;
  whyNow: string;
  lastActivity?: string;
  signals: Signal[];
  outreachDraft: string;
  outreachStatus: "pending" | "approved" | "scheduled" | "sent";
  aiInsight: string;
  suggestedAction: string;
  selectedLead?: SelectedLead;
  outreachSequence?: OutreachSequenceStep[];
}

export interface ProspectPool {
  id: string;
  name: string;
  icp: ICPConfig;
  execution_ids: string[];
  created_at: string;
}

export interface ProspectPoolRun {
  id: string;
  prospect_pool_id: string;
  status: "running" | "completed" | "failed";
  execution_date: string;
  articles_scanned: number;
  signals_extracted: number;
  accounts_found: number;
  results?: any;
}

export interface PipelineStatus {
  isRunning: boolean;
  lastRun?: string | null;
  prospectPoolId?: string;
  totalAccounts: number;
  totalSignals: number;
  articlesScanned?: number;
  messages: string[];
  agentMetrics?: Record<string, {
    started_at?: string;
    finished_at?: string;
    duration_seconds?: number;
    last_message?: string;
  }>;
}

export interface ICPConfig {
  industries: string[];
  size: string;
  geos: string[];
  signals: string[];
  pain: string;
  startDate?: string;
  endDate?: string;
  daysBack?: number;
}

export interface Alert {
  id: string;
  companyId: string;
  companyName: string;
  signalType: SignalType | string;
  signal: string;
  whyMatters: string;
  time?: string;
  intentScore?: number;
  priority?: Priority;
  unread: boolean;
}
