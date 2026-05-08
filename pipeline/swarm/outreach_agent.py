import os, yaml
from langchain_openai import ChatOpenAI

class OutreachAgent:
    """
    Consolidated Outreach Agent: Generates personalized opening lines.
    Formerly outreach_agent.py and scoring_tools.py (drafting portion).
    """
    def __init__(self):
        self.name = "outreach"
        self.llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)

    def _load_prompts(self):
        path = os.path.join(os.path.dirname(__file__), "../../config/prompts.yaml")
        with open(path, "r") as f:
            return yaml.safe_load(f)

    def work(self, state: dict) -> dict:
        scored = state.get("scored", [])
        icp_context = state.get("icp", "")
        prompts = self._load_prompts()
        drafts = {}

        for acc in scored[:12]:
            company = acc["company"]
            signals = acc.get("signals", [])
            sig_text = "; ".join(s.get("headline", "") for s in signals[:2])
            
            prompt = prompts["outreach_prompt"].format(
                blostem_info=prompts["blostem_profile"],
                company_name=company,
                signal_summary=sig_text,
                icp_context=icp_context
            )
            
            try:
                res = self.llm.invoke(prompt)
                drafts[company] = res.content.strip().replace('"', '')
            except:
                drafts[company] = f"I noticed {company}'s recent activity and wanted to connect regarding Blostem."

        return {
            "outreach_drafts": drafts,
            "messages": [f"[Outreach] Crafted {len(drafts)} strategic openers for Blostem."]
        }
