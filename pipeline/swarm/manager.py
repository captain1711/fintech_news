import logging
from datetime import datetime
from pipeline.db import db
from pipeline.swarm.researcher_agent import ResearchAgent
from pipeline.swarm.extractor_agent import ExtractorAgent
from pipeline.swarm.enricher_agent import EnricherAgent
from pipeline.swarm.scorer_agent import ScorerAgent
from pipeline.swarm.outreach_agent import OutreachAgent

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

class SwarmManager:
    """
    The Swarm Manager: Orchestrates agent communication and execution.
    Acts as the 'Brain' of the system.
    """
    def __init__(self, exec_id: str):
        self.exec_id = exec_id
        self.agents = {
            "researcher_agent": ResearchAgent(),
            "extractor_agent": ExtractorAgent(),
            "enricher_agent": EnricherAgent(),
            "scorer_agent": ScorerAgent(),
            "outreach_agent": OutreachAgent()
        }
        self.sequence = ["researcher_agent", "extractor_agent", "enricher_agent", "scorer_agent", "outreach_agent"]

    def run(self, initial_state: dict):
        state = initial_state.copy()
        state.setdefault("messages", [])
        state.setdefault("agent_metrics", {})

        db.set(f"swarm:{self.exec_id}:status", "running")
        
        for agent_name in self.sequence:
            agent = self.agents[agent_name]
            try:
                logger.info("Activating agent %s for execution %s", agent_name, self.exec_id)
                checkpoint_key = f"swarm:{self.exec_id}:checkpoint:{agent_name}"
                db.set(f"{checkpoint_key}_start", state)
                start_time = datetime.utcnow()
                
                output = agent.work(state.copy())
                end_time = datetime.utcnow()
                
                self._merge_state(state, output)
                self._record_agent_metrics(
                    state,
                    agent_name,
                    start_time,
                    end_time,
                    output
                )
                
                db.set(f"{checkpoint_key}_end", state)
                db.set(f"swarm:{self.exec_id}:current_state", state)
                
            except Exception as e:
                logger.exception("Agent %s failed: %s", agent_name, str(e))
                db.set(f"swarm:{self.exec_id}:status", f"failed_at_{agent_name}")
                db.set(f"swarm:{self.exec_id}:error", str(e))
                raise e

        db.set(f"swarm:{self.exec_id}:status", "completed")
        db.set(f"swarm:{self.exec_id}:final_results", state)
        return state

    def get_status(self):
        return db.get(f"swarm:{self.exec_id}:status")

    def get_results(self):
        return db.get(f"swarm:{self.exec_id}:final_results")

    def _merge_state(self, state: dict, output: dict):
        if not output:
            return

        for key, value in output.items():
            if key == "messages":
                state.setdefault("messages", [])
                state["messages"].extend(value or [])
            elif isinstance(value, dict):
                existing = state.get(key, {})
                if isinstance(existing, dict):
                    existing.update(value)
                    state[key] = existing
                else:
                    state[key] = value
            else:
                state[key] = value

    def _record_agent_metrics(self, state: dict, agent_name: str, start, end, output: dict):
        metrics = state.setdefault("agent_metrics", {})
        metrics[agent_name] = {
            "started_at": start.isoformat() + "Z",
            "finished_at": end.isoformat() + "Z",
            "duration_seconds": round((end - start).total_seconds(), 2),
            "last_message": (output.get("messages") or [""])[-1] if output else "",
        }
