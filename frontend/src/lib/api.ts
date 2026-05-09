import type { Account, Alert, PipelineStatus, ICPConfig, ProspectPool, ProspectPoolRun, Contact, OutreachSequenceStep } from "@/types/api";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "http://localhost:8000" : window.location.origin);

async function request<T>(path: string, options?: RequestInit) {
  const url = new URL(`${API_BASE_URL}${path}`);
  const response = await fetch(url.toString(), options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function fetchProspectPools() {
  return request<ProspectPool[]>("/prospect-pools");
}

export function createProspectPool(name: string, icp: ICPConfig) {
  return request<ProspectPool>("/prospect-pools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, icp }),
  });
}

export function fetchProspectPoolRuns(poolId: string) {
  return request<ProspectPoolRun[]>(`/prospect-pools/${poolId}/executions`);
}

export function fetchAccounts(poolId: string, executionId: string) {
  return request<Account[]>(`/prospect-pools/${poolId}/executions/${executionId}/accounts`);
}

export function fetchExecutionStatus(poolId: string, executionId: string) {
  return request<PipelineStatus>(`/prospect-pools/${poolId}/executions/${executionId}/status`);
}

export function fetchOutreach(executionId?: string) {
  return request<Account[]>(executionId ? `/outreach?execution_id=${executionId}` : "/outreach");
}

export function updateOutreachStatus(accountId: string, executionId: string, status: string) {
  return request<{ status: string }>("/outreach/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account_id: accountId, execution_id: executionId, status }),
  });
}

export function updateOutreachDraft(accountId: string, executionId: string, draft: string) {
  return request<{ status: string }>("/outreach/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account_id: accountId, execution_id: executionId, draft }),
  });
}

export function startProspectPoolRun(poolId: string) {
  return request<{ message: string; execution_id: string }>("/pipeline/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prospect_pool_id: poolId }),
  });
}

export function fetchAlerts() {
  return request<Alert[]>("/alerts");
}

export function subscribeToAlerts(email: string) {
  return request<{ status: string }>("/alerts/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export function fetchAccount(poolId: string, executionId: string, accountId: string) {
  return request<Account>(`/prospect-pools/${poolId}/executions/${executionId}/accounts/${accountId}`);
}

export function fetchDeepReview(poolId: string, executionId: string, accountId: string) {
  return request<{ account: Account; review: any }>(`/prospect-pools/${poolId}/executions/${executionId}/accounts/${accountId}/review`);
}

export function fetchContacts(poolId: string, executionId: string, accountId: string, role: string) {
  const params = new URLSearchParams({ role });
  return request<{ contacts: Contact[] }>(`/prospect-pools/${poolId}/executions/${executionId}/accounts/${accountId}/contacts?${params.toString()}`);
}

interface SequencePayload {
  role: string;
  lead: Contact;
  custom_sequence?: OutreachSequenceStep[];
}

export function generateOutreachSequence(poolId: string, executionId: string, accountId: string, payload: SequencePayload) {
  return request<{ sequence: OutreachSequenceStep[] }>(`/prospect-pools/${poolId}/executions/${executionId}/accounts/${accountId}/sequence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function saveOutreachSequence(poolId: string, executionId: string, accountId: string, sequence: OutreachSequenceStep[]) {
  return request<{ sequence: OutreachSequenceStep[] }>(`/prospect-pools/${poolId}/executions/${executionId}/accounts/${accountId}/sequence`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sequence }),
  });
}
