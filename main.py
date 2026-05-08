import os
from dotenv import load_dotenv
load_dotenv()

import uuid
from pipeline.swarm.manager import SwarmManager

def run(icp: str = "Indian BFSI and fintech companies needing payment infrastructure"):
    exec_id = f"cli-{uuid.uuid4().hex[:8]}"
    manager = SwarmManager(exec_id)
    initial_state = {
        "prospect_pool_id": "cli",
        "icp": icp,
        "articles": [],
        "signals": [],
        "accounts": {},
        "scored": [],
        "outreach_drafts": {},
        "research_loop_count": 0,
        "messages": [],
    }
    final_state = manager.run(initial_state)

    print("\n=== TOP 10 ACCOUNTS ===")
    for i, acc in enumerate(final_state.get("scored", [])[:10], 1):
        print(f"\n{i}. {acc.get('company')} | Score: {acc.get('final_score')}")
        print(f"   Signals: {acc.get('signal_count')} | Type: {acc.get('organization_type')}")
        print(f"   Outreach: {final_state.get('outreach_drafts', {}).get(acc.get('company'), 'N/A')}")

    return final_state

if __name__ == "__main__":
    run()
