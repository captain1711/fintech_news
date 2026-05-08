import os
import logging
import copy
import json
import re
import uuid
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Optional, Any

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from langchain_openai import ChatOpenAI
import yaml

from pipeline.db import db
from pipeline.swarm.manager import SwarmManager
from pipeline.tools.enrichment_tools import deep_review_company
from pipeline.services.rocketreach import rocketreach_client
from pipeline.services.emailer import email_client

logger = logging.getLogger(__name__)

app = FastAPI(title="Blostem Swarm API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
CONTACT_CACHE_DIR = Path(os.getenv("CONTACT_CACHE_DIR", BASE_DIR / "data" / "contact_logs"))
CONTACT_CACHE_DIR.mkdir(parents=True, exist_ok=True)
PROMPTS_PATH = BASE_DIR / "config" / "prompts.yaml"
with PROMPTS_PATH.open("r") as prompt_file:
    PROMPTS_CONFIG = yaml.safe_load(prompt_file)
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"

ALERTS_POOL_ID = os.getenv("ALERTS_POOL_ID", "global-finpay")
ALERTS_POOL_NAME = os.getenv("ALERTS_POOL_NAME", "Fintech & Payments Pulse")
ALERT_SCAN_INTERVAL_SECONDS = int(os.getenv("ALERT_SCAN_INTERVAL_SECONDS", "3600"))
DEFAULT_ALERT_ICP = {
    "industries": ["Fintech", "Payments", "BFSI"],
    "size": "Growth",
    "geos": ["India", "SEA"],
    "signals": ["Funding", "Regulatory", "Product", "Partnership"],
    "pain": "Identify high-intent fintech and banking companies expanding infrastructure or facing regulatory urgency.",
    "daysBack": 30,
}

def _escape_prompt_text(value: str) -> str:
    return value.replace("{", "{{").replace("}", "}}")

EMAIL_TEMPLATE = PROMPTS_CONFIG["outreach_email_template"]
SEQUENCE_PROMPT_TEMPLATE = PROMPTS_CONFIG["outreach_sequence_prompt"]
SENDER_NAME = os.getenv("OUTREACH_SENDER_NAME", "Blostem SDR Team")
SENDER_TITLE = os.getenv("OUTREACH_SENDER_TITLE", "Sales Development")

sequence_llm = ChatOpenAI(
    model=os.getenv("OUTREACH_SEQUENCE_MODEL", "gpt-4o-mini"),
    temperature=float(os.getenv("OUTREACH_SEQUENCE_TEMPERATURE", "0.4")),
)


class ICPConfig(BaseModel):
    industries: List[str]
    size: str
    geos: List[str]
    signals: List[str]
    pain: str
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    daysBack: Optional[int] = 30


class ProspectPoolCreate(BaseModel):
    name: str
    icp: ICPConfig


class RunPipelineRequest(BaseModel):
    prospect_pool_id: str


class OutreachUpdate(BaseModel):
    account_id: str
    execution_id: str
    status: str  # pending, approved, scheduled, sent


class OutreachDraftUpdate(BaseModel):
    account_id: str
    execution_id: str
    draft: str


class OutreachSequenceRequest(BaseModel):
    role: str
    lead: Dict[str, Any]
    custom_sequence: Optional[List[Dict[str, Any]]] = None


class AlertSubscribeRequest(BaseModel):
    email: str


def get_full_state():
    state = db.get("state_store")
    if not state:
        state = {"prospect_pools": {}, "executions": {}, "outreach": {}}
        db.set("state_store", state)
    return _ensure_alert_structures(state)


def save_full_state(state):
    db.set("state_store", _ensure_alert_structures(state))


def _ensure_alert_structures(state: Dict) -> Dict:
    state.setdefault("prospect_pools", {})
    state.setdefault("executions", {})
    state.setdefault("outreach", {})
    state.setdefault("alert_subscribers", [])
    state.setdefault("alerts_meta", {})
    state.setdefault("alerts_feed", {})
    return state


EVENT_LABELS = {
    "funding": "Funding",
    "hiring": "Hiring",
    "regulatory": "Regulatory",
    "regulatory_action": "Regulatory",
    "product_launch": "Product Launch",
    "product": "Product Launch",
    "strategic": "Partnership",
    "partnership": "Partnership",
    "modernization": "Modernization",
    "compliance": "Compliance",
}

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _build_sequence_prompt(context: Dict[str, Any]) -> str:
    return SEQUENCE_PROMPT_TEMPLATE.format(
        context_block=json.dumps(context, indent=2),
        email_template=_escape_prompt_text(EMAIL_TEMPLATE),
    )


def _cache_contacts_snapshot(execution_id: str, account_id: str, role: str, contacts: List[Dict]):
    safe_account = slugify(account_id)
    filename = f"{execution_id}_{safe_account}_{slugify(role)}.json"
    snapshot = {
        "execution_id": execution_id,
        "account_id": account_id,
        "role": role,
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "contacts": contacts,
    }
    path = CONTACT_CACHE_DIR / filename
    with path.open("w") as fh:
        json.dump(snapshot, fh, indent=2)


def _derive_lead_first_name(lead: Dict[str, Any]) -> str:
    if not lead:
        return "there"
    for key in ("first_name", "firstName"):
        if lead.get(key):
            return lead[key]
    name = lead.get("name") or ""
    return (name.split()[0] if name else "there")


def _summarize_signals(signals: List[Dict[str, Any]]) -> str:
    snippets = []
    for sig in signals[:2]:
        label = EVENT_LABELS.get((sig.get("type") or "").lower(), sig.get("type") or "Signal")
        desc = sig.get("description") or sig.get("headline")
        if desc:
            snippets.append(f"{label}: {desc}")
    return "; ".join(snippets) or "recent activity your team is driving"


def _render_email_body(account: Dict[str, Any], lead: Dict[str, Any], role: str, body_text: str) -> str:
    safe_body = (body_text or "").strip().replace("{", "{{").replace("}", "}}")
    first_name = _derive_lead_first_name(lead)
    template_values = {
        "lead_first_name": first_name,
        "body": safe_body,
        "sender_name": SENDER_NAME,
        "sender_title": SENDER_TITLE,
    }
    return EMAIL_TEMPLATE.format(**template_values)


def _parse_iso_timestamp(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (value or "unknown").lower()).strip("-") or "unknown"


def _ensure_alerts_pool():
    state = get_full_state()
    if ALERTS_POOL_ID not in state["prospect_pools"]:
        state["prospect_pools"][ALERTS_POOL_ID] = {
            "id": ALERTS_POOL_ID,
            "name": ALERTS_POOL_NAME,
            "icp": DEFAULT_ALERT_ICP,
            "execution_ids": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        save_full_state(state)


def priority_from_score(score: float) -> str:
    if score >= 80:
        return "Hot"
    if score >= 60:
        return "Warm"
    return "Cold"


def _get_live_state(execution_id: str) -> Optional[Dict]:
    snapshot = db.get(f"swarm:{execution_id}:current_state")
    return copy.deepcopy(snapshot) if snapshot else None


def _execution_snapshot(execution: Dict) -> Dict:
    if execution.get("status") == "running":
        live = _get_live_state(execution["id"])
        if live:
            return live
    return execution.get("results") or {}


def _derive_scored_accounts(result_state: Dict) -> List[Dict]:
    if not result_state:
        return []
    scored = result_state.get("scored")
    if isinstance(scored, list) and scored:
        return copy.deepcopy(scored)
    accounts = result_state.get("accounts")
    if isinstance(accounts, dict) and accounts:
        derived = []
        for details in accounts.values():
            entry = copy.deepcopy(details)
            if entry.get("final_score") is None:
                intent = entry.get("top_intent_score", 0) or 0
                count = entry.get("signal_count", 0) or 0
                entry["final_score"] = min(round(intent + count * 5, 1), 100)
            derived.append(entry)
        return sorted(derived, key=lambda x: x.get("final_score", 0), reverse=True)
    return []


def _create_execution_record(pool_id: str) -> str:
    state = get_full_state()
    pool = state["prospect_pools"].get(pool_id)
    if not pool:
        raise ValueError(f"Prospect pool {pool_id} not found")
    exec_id = f"exec-{str(uuid.uuid4())[:8]}"
    state["executions"][exec_id] = {
        "id": exec_id,
        "prospect_pool_id": pool_id,
        "status": "running",
        "execution_date": datetime.now(timezone.utc).isoformat(),
        "articles_scanned": 0,
        "signals_extracted": 0,
        "accounts_found": 0,
        "results": {},
    }
    pool["execution_ids"].append(exec_id)
    save_full_state(state)
    return exec_id


def _execute_swarm_pipeline(exec_id: str, pool_id: str, icp: Dict, send_alert_digest: bool = False):
    try:
        manager = SwarmManager(exec_id)
        initial_state = {
            "prospect_pool_id": pool_id,
            "icp": icp.get("pain"),
            "industries": icp.get("industries", []),
            "signal_triggers": icp.get("signals", []),
            "articles": [],
            "signals": [],
            "accounts": {},
            "scored": [],
            "outreach_drafts": {},
        }
        final_state = manager.run(initial_state)
        state = get_full_state()
        state["executions"][exec_id].update({
            "status": "completed",
            "articles_scanned": len(final_state.get("articles", [])),
            "signals_extracted": len(final_state.get("signals", [])),
            "accounts_found": len(final_state.get("scored", [])),
            "results": final_state,
        })
        save_full_state(state)

        if send_alert_digest:
            accounts = _update_alert_feed(exec_id)
            _send_alert_digest(accounts)
    except Exception as exc:
        state = get_full_state()
        if exec_id in state["executions"]:
            state["executions"][exec_id]["status"] = "failed"
            save_full_state(state)
        logger.exception("Swarm execution failed: %s", exc)


def build_accounts_payload(execution_id: str) -> List[Dict]:
    state = get_full_state()
    execution = state["executions"].get(execution_id)
    if not execution:
        return []

    snapshot = _execution_snapshot(execution)
    fallback_results = execution.get("results") or {}

    scored = _derive_scored_accounts(snapshot)
    outreach_drafts = snapshot.get("outreach_drafts") or fallback_results.get("outreach_drafts") or {}
    outreach_sequences = snapshot.get("outreach_sequences") or fallback_results.get("outreach_sequences") or {}
    outreach_contacts = snapshot.get("outreach_contacts") or fallback_results.get("outreach_contacts") or {}

    accounts = []
    state_outreach = state["outreach"]

    for entry in scored:
        company = entry.get("company", "Unknown")
        account_id = slugify(company)
        raw_signals = entry.get("signals", [])

        signals = []
        for idx, sig in enumerate(raw_signals):
            sig_type = EVENT_LABELS.get((sig.get("event_type") or "").lower(), "Product Launch")
            signals.append({
                "id": f"{account_id}-sig-{idx}",
                "type": sig_type,
                "description": sig.get("headline", ""),
                "date": sig.get("date") or execution.get("execution_date") or "Unknown",
                "intentScore": sig.get("intent_score", 0),
            })

        enrichment = entry.get("enrichment", {}) or {}
        outreach_key = f"{execution_id}:{account_id}"
        status = state_outreach.get(outreach_key, "pending")

        accounts.append({
            "id": account_id,
            "prospectPoolId": execution["prospect_pool_id"],
            "executionId": execution_id,
            "name": company,
            "domain": enrichment.get("domain") or f"{account_id}.com",
            "industry": (entry.get("organization_type") or "unknown").capitalize(),
            "size": enrichment.get("size", "Growth"),
            "score": entry.get("final_score", 0),
            "priority": priority_from_score(entry.get("final_score", 0)),
            "signalsCount": entry.get("signal_count", len(signals)),
            "whyNow": signals[0]["description"] if signals else "No signals detected",
            "lastActivity": signals[0]["date"] if signals else execution.get("execution_date"),
            "signals": signals,
            "outreachDraft": outreach_drafts.get(company, ""),
            "outreachStatus": status,
            "aiInsight": enrichment.get("description") or "No AI insight available yet.",
            "suggestedAction": entry.get("suggested_action") or "Engage based on latest signal.",
            "selectedLead": outreach_contacts.get(account_id),
            "outreachSequence": outreach_sequences.get(account_id, []),
        })

    return sorted(accounts, key=lambda x: x["score"], reverse=True)


def _update_alert_feed(execution_id: str) -> List[Dict]:
    accounts = build_accounts_payload(execution_id)[:10]
    state = get_full_state()
    state["alerts_feed"] = {
        "execution_id": execution_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "accounts": accounts,
    }
    save_full_state(state)
    return accounts


def _format_alert_digest(accounts: List[Dict], generated_at: Optional[str]) -> str:
    lines = [
        "Fintech & Payments hourly pulse from Blostem",
        f"Generated at: {generated_at or datetime.now(timezone.utc).isoformat()}",
        "",
    ]
    for idx, acc in enumerate(accounts[:5], start=1):
        top_signal = (acc.get("signals") or [{}])[0]
        lines.append(
            f"{idx}. {acc.get('name')} — Score {acc.get('score')} ({acc.get('priority')})"
        )
        if top_signal:
            lines.append(f"   Signal: {top_signal.get('type')} - {top_signal.get('description')}")
        lines.append(f"   Why now: {acc.get('whyNow')}")
        lines.append("")
    lines.append("You're receiving this because you subscribed to Blostem Alerts.")
    lines.append("Unsubscribe by replying STOP.")
    return "\n".join(lines)


def _send_alert_digest(accounts: List[Dict]):
    if not accounts:
        return
    state = get_full_state()
    subscribers = state.get("alert_subscribers", [])
    if not subscribers:
        return
    feed = state.get("alerts_feed", {})
    generated_at = feed.get("generated_at")
    subject = f"Blostem Alerts · {datetime.now(timezone.utc).strftime('%b %d %H:%M UTC')}"
    body = _format_alert_digest(accounts, generated_at)
    for email in subscribers:
        email_client.send_email(email, subject, body)


def _send_welcome_email(email: str):
    subject = "Welcome to Blostem Alerts"
    body = (
        "Hi there,\n\n"
        "Thanks for subscribing to the Blostem Alerts feed. "
        "We'll send you a ranked snapshot of the highest-intent fintech and payments accounts every hour.\n\n"
        "Stay tuned,\n"
        "Team Blostem"
    )
    email_client.send_email(email, subject, body)


async def _alerts_scheduler():
    await asyncio.sleep(5)
    while True:
        try:
            await asyncio.to_thread(_maybe_run_alert_cycle)
        except Exception as exc:
            logger.exception("Hourly alerts job failed: %s", exc)
        await asyncio.sleep(ALERT_SCAN_INTERVAL_SECONDS)


def _maybe_run_alert_cycle(force: bool = False):
    state = get_full_state()
    meta = state["alerts_meta"]
    if meta.get("is_running"):
        return
    now = datetime.now(timezone.utc)
    last_run = _parse_iso_timestamp(meta.get("last_run"))
    if not force and last_run:
        elapsed = (now - last_run).total_seconds()
        if elapsed < ALERT_SCAN_INTERVAL_SECONDS:
            return

    meta["is_running"] = True
    save_full_state(state)
    exec_id = None
    try:
        _ensure_alerts_pool()
        exec_id = _create_execution_record(ALERTS_POOL_ID)
        pool = get_full_state()["prospect_pools"][ALERTS_POOL_ID]
        _execute_swarm_pipeline(exec_id, ALERTS_POOL_ID, pool.get("icp", DEFAULT_ALERT_ICP), send_alert_digest=True)
    finally:
        state = get_full_state()
        meta = state["alerts_meta"]
        meta["is_running"] = False
        if exec_id:
            meta["last_execution"] = exec_id
            meta["last_run"] = datetime.now(timezone.utc).isoformat()
        save_full_state(state)


@app.on_event("startup")
async def startup_event():
    _ensure_alerts_pool()
    asyncio.create_task(_alerts_scheduler())


@app.get("/prospect-pools")
def list_prospect_pools():
    state = get_full_state()
    pools = list(state["prospect_pools"].values())
    return sorted(pools, key=lambda p: p.get("created_at", ""), reverse=True)


@app.post("/prospect-pools")
def create_prospect_pool(pool: ProspectPoolCreate):
    state = get_full_state()
    new_id = str(uuid.uuid4())[:8]
    state["prospect_pools"][new_id] = {
        "id": new_id,
        "name": pool.name,
        "icp": pool.icp.model_dump(),
        "execution_ids": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    save_full_state(state)
    return state["prospect_pools"][new_id]


@app.get("/prospect-pools/{pool_id}/executions")
def list_executions(pool_id: str):
    state = get_full_state()
    pool = state["prospect_pools"].get(pool_id)
    if not pool:
        raise HTTPException(status_code=404, detail="Prospect pool not found")
    return [state["executions"][eid] for eid in pool["execution_ids"] if eid in state["executions"]]


@app.get("/prospect-pools/{pool_id}/executions/{execution_id}/accounts")
def list_execution_accounts(pool_id: str, execution_id: str):
    execution_accounts = build_accounts_payload(execution_id)
    state = get_full_state()
    execution = state["executions"].get(execution_id)
    if not execution or execution["prospect_pool_id"] != pool_id:
        raise HTTPException(status_code=404, detail="Execution not found for this pool")
    return execution_accounts


@app.get("/prospect-pools/{pool_id}/executions/{execution_id}/accounts/{account_id}")
def get_account(pool_id: str, execution_id: str, account_id: str):
    accounts = list_execution_accounts(pool_id, execution_id)
    account = next((a for a in accounts if a["id"] == account_id), None)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@app.get("/prospect-pools/{pool_id}/executions/{execution_id}/accounts/{account_id}/review")
def get_account_deep_review(pool_id: str, execution_id: str, account_id: str):
    account = get_account(pool_id, execution_id, account_id)
    review_data = deep_review_company.invoke({
        "company_name": account["name"],
        "domain": account.get("domain")
    })
    return {"account": account, "review": review_data}


@app.get("/prospect-pools/{pool_id}/executions/{execution_id}/accounts/{account_id}/contacts")
def get_account_contacts(pool_id: str, execution_id: str, account_id: str, role: str = "Head of Partnerships", limit: int = 5):
    account = get_account(pool_id, execution_id, account_id)
    try:
        contacts = rocketreach_client.search_contacts(
            company=account["name"],
            role=role,
            limit=min(limit, 10),
        )
        _cache_contacts_snapshot(execution_id, account_id, role, contacts)
    except ValueError as exc:
        logger.warning("RocketReach validation error: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("RocketReach contact lookup failed: %s", exc)
        raise HTTPException(status_code=502, detail="Unable to fetch contacts from RocketReach")
    return {"contacts": contacts}


@app.post("/prospect-pools/{pool_id}/executions/{execution_id}/accounts/{account_id}/sequence")
def upsert_outreach_sequence(pool_id: str, execution_id: str, account_id: str, request: OutreachSequenceRequest):
    account = get_account(pool_id, execution_id, account_id)
    state = get_full_state()
    execution = state["executions"].get(execution_id)
    pool = state["prospect_pools"].get(pool_id)
    if not execution or not pool:
        raise HTTPException(status_code=404, detail="Execution or pool not found")

    if request.custom_sequence:
        sequence = request.custom_sequence
    else:
        sequence = _generate_outreach_sequence(
            account=account,
            lead=request.lead,
            role=request.role,
            signals=account.get("signals", []),
            icp=pool.get("icp", {}),
        )

    _store_outreach_sequence(state, execution_id, account_id, sequence, request.lead, request.role)
    save_full_state(state)
    return {"sequence": sequence}


@app.get("/prospect-pools/{pool_id}/executions/{execution_id}/status")
def execution_status(pool_id: str, execution_id: str):
    state = get_full_state()
    execution = state["executions"].get(execution_id)
    if not execution or execution["prospect_pool_id"] != pool_id:
        raise HTTPException(status_code=404, detail="Execution not found")
    snapshot = _execution_snapshot(execution)
    signals = len(snapshot.get("signals", [])) if snapshot else execution.get("signals_extracted", 0)
    articles = len(snapshot.get("articles", [])) if snapshot else execution.get("articles_scanned", 0)
    accounts = len(_derive_scored_accounts(snapshot)) if snapshot else execution.get("accounts_found", 0)
    return {
        "isRunning": execution["status"] == "running",
        "lastRun": execution["execution_date"],
        "prospectPoolId": execution["prospect_pool_id"],
        "totalAccounts": accounts,
        "totalSignals": signals,
        "articlesScanned": articles,
        "messages": snapshot.get("messages", []),
        "agentMetrics": snapshot.get("agent_metrics", {}),
    }


@app.get("/outreach")
def list_outreach(execution_id: Optional[str] = None):
    state = get_full_state()
    execution_ids = [execution_id] if execution_id else list(state["executions"].keys())
    accounts: List[Dict] = []
    for eid in execution_ids:
        accounts.extend(build_accounts_payload(eid))
    return accounts


@app.post("/outreach/status")
def update_outreach_status(update: OutreachUpdate):
    state = get_full_state()
    key = f"{update.execution_id}:{update.account_id}"
    state["outreach"][key] = update.status
    save_full_state(state)
    return {"status": "updated"}


@app.post("/outreach/draft")
def update_outreach_draft(update: OutreachDraftUpdate):
    state = get_full_state()
    execution = state["executions"].get(update.execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    execution.setdefault("results", {})
    drafts = execution["results"].setdefault("outreach_drafts", {})
    drafts[update.account_id] = update.draft
    save_full_state(state)
    return {"status": "updated"}


@app.get("/alerts")
def list_alerts():
    state = get_full_state()
    feed = state.get("alerts_feed") or {}
    generated_at = feed.get("generated_at")
    execution_id = feed.get("execution_id")
    feed_accounts = feed.get("accounts") or []
    alerts = []

    if feed_accounts:
        for acc in feed_accounts:
            top_signal = (acc.get("signals") or [{}])[0]
            alerts.append({
                "id": f"alert-{acc['id']}-{execution_id}",
                "companyId": acc["id"],
                "companyName": acc["name"],
                "signalType": top_signal.get("type") if top_signal else "Signal",
                "signal": acc.get("whyNow"),
                "whyMatters": acc.get("suggestedAction"),
                "intentScore": acc.get("score"),
                "priority": acc.get("priority"),
                "unread": True,
                "time": generated_at,
            })
        return alerts

    # Fallback: derive from recent executions if feed empty
    for execution in list(state["executions"].values())[-3:]:
        scored = build_accounts_payload(execution["id"])
        for acc in scored[:3]:
            alerts.append({
                "id": f"alert-{acc['id']}-{execution['id']}",
                "companyId": acc["id"],
                "companyName": acc["name"],
                "signalType": acc["signals"][0]["type"] if acc["signals"] else "Signal",
                "signal": acc["whyNow"],
                "whyMatters": acc["suggestedAction"],
                "intentScore": acc["score"],
                "unread": True,
                "time": execution.get("execution_date"),
            })
    return alerts


@app.post("/alerts/subscribe")
def subscribe_alerts(request: AlertSubscribeRequest):
    email = (request.email or "").strip().lower()
    if not EMAIL_REGEX.match(email):
        raise HTTPException(status_code=400, detail="Invalid email address")

    state = get_full_state()
    subscribers = state["alert_subscribers"]
    if email not in subscribers:
        subscribers.append(email)
        save_full_state(state)
        _send_welcome_email(email)
        return {"status": "subscribed"}
    return {"status": "exists"}


@app.post("/pipeline/run")
async def run_prospect_pool(request: RunPipelineRequest, background_tasks: BackgroundTasks):
    state = get_full_state()
    pool = state["prospect_pools"].get(request.prospect_pool_id)
    if not pool:
        raise HTTPException(status_code=404, detail="Prospect pool not found")

    exec_id = _create_execution_record(request.prospect_pool_id)
    icp = pool["icp"]
    background_tasks.add_task(
        _execute_swarm_pipeline,
        exec_id,
        request.prospect_pool_id,
        icp,
        request.prospect_pool_id == ALERTS_POOL_ID,
    )
    return {"message": "Prospect pool run started", "execution_id": exec_id}


def _generate_outreach_sequence(account: Dict, lead: Dict, role: str, signals: List[Dict], icp: Dict) -> List[Dict]:
    signal_lines = [f"- {sig.get('type', 'Signal')}: {sig.get('description')}" for sig in signals[:3]]
    lead_context = {
        "name": lead.get("name"),
        "first_name": lead.get("first_name") or lead.get("firstName"),
        "title": lead.get("title") or role,
        "email": lead.get("email"),
        "company": lead.get("company"),
        "location": lead.get("location"),
    }
    context = {
        "account": {
            "name": account.get("name"),
            "industry": account.get("industry"),
            "size": account.get("size"),
            "suggestedAction": account.get("suggestedAction"),
        },
        "lead": lead,
        "lead_profile": lead_context,
        "role": role,
        "signals": signal_lines,
        "icp": icp,
    }
    prompt = _build_sequence_prompt(context)
    response = sequence_llm.invoke(prompt)
    dynamic_steps = _parse_sequence_response(response.content)
    final_steps = []
    for idx, step in enumerate(dynamic_steps):
        rendered_body = _render_email_body(
            account,
            lead,
            role,
            step.get("body", "")
        )
        wait_days = step.get("wait_days")
        if wait_days is None:
            wait_days = 0 if idx == 0 else 2 * idx
        final_steps.append({
            "step": step.get("step", idx + 1),
            "subject": step.get("subject", ""),
            "body": rendered_body,
            "wait_days": wait_days,
        })
    return final_steps


def _parse_sequence_response(raw: str) -> List[Dict]:
    cleaned = raw.strip().strip("`").strip()
    try:
        data = json.loads(cleaned)
        steps = []
        for idx, item in enumerate(data):
            steps.append({
                "step": item.get("step", idx + 1),
                "subject": item.get("subject", ""),
                "body": item.get("body", ""),
                "wait_days": item.get("wait_days", 0),
            })
        if steps:
            return steps
    except json.JSONDecodeError:
        pass
    paragraphs = [p.strip() for p in cleaned.split("\n\n") if p.strip()]
    steps = []
    for idx, block in enumerate(paragraphs[:3]):
        subject, body = (block.split("\n", 1) + [""])[:2]
        steps.append({
            "step": idx + 1,
            "subject": subject[:80],
            "body": body.strip(),
            "wait_days": 0 if idx == 0 else 2 * idx,
        })
    return steps or [{"step": 1, "subject": "Checking in", "body": cleaned, "wait_days": 0}]


def _store_outreach_sequence(state: Dict, execution_id: str, account_id: str, sequence: List[Dict], lead: Dict, role: str):
    execution = state["executions"][execution_id]
    execution.setdefault("results", {})
    results = execution["results"]
    sequences = results.setdefault("outreach_sequences", {})
    sequences[account_id] = sequence
    contacts = results.setdefault("outreach_contacts", {})
    contacts[account_id] = {"lead": lead, "role": role}


def _frontend_index_path() -> Optional[Path]:
    index_path = FRONTEND_DIST / "index.html"
    return index_path if index_path.exists() else None


if _frontend_index_path():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/", include_in_schema=False)
    async def serve_root():
        return FileResponse(_frontend_index_path())

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        candidate = (FRONTEND_DIST / full_path).resolve()
        index_path = _frontend_index_path()
        try:
            candidate.relative_to(FRONTEND_DIST)
        except ValueError:
            candidate = index_path
        if not candidate or not candidate.exists():
            candidate = index_path
        return FileResponse(candidate or FRONTEND_DIST / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
