import json, re, os, yaml
from langchain_openai import ChatOpenAI

class ExtractorAgent:
    """
    Consolidated Signal Agent: Extracts intent signals from raw text.
    Formerly signal_agent.py and signal_tools.py.
    """
    def __init__(self):
        self.name = "extractor_agent"
        self.llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    def _load_prompt(self):
        path = os.path.join(os.path.dirname(__file__), "../../config/prompts.yaml")
        with open(path) as f:
            return yaml.safe_load(f)["signal_extractor_prompt"]

    def _parse_json(self, text: str) -> list:
        cleaned = re.sub(r"```(?:json)?|```", "", text).strip()
        try:
            result = json.loads(cleaned)
            if isinstance(result, list): return result
            for k in ("signals","results","data"):
                if k in result and isinstance(result[k], list): return result[k]
        except: pass
        m = re.search(r'\[.*\]', cleaned, re.DOTALL)
        if m:
            try: return json.loads(m.group())
            except: pass
        return []

    def work(self, state: dict) -> dict:
        articles = state.get("articles", [])
        if not articles:
            return {"signals": [], "messages": ["No articles found to extract signals from."]}

        batches = [articles[i:i+10] for i in range(0, len(articles), 10)]
        all_signals = []
        prompt_template = self._load_prompt()

        for batch in batches:
            prompt = prompt_template.replace("{articles_text}", json.dumps(batch, indent=2))
            response = self.llm.invoke(prompt)
            signals = self._parse_json(response.content)
            if isinstance(signals, list):
                all_signals.extend(signals)

        seen, unique = set(), []
        for s in all_signals:
            key = (s.get("company","").lower(), s.get("event_type","").lower(), s.get("date",""))
            if key not in seen:
                seen.add(key)
                unique.append(s)
        
        final_signals = sorted(unique, key=lambda x: x.get("intent_score", 0), reverse=True)
        return {
            "signals": final_signals,
            "messages": [f"[Extractor] Identified {len(final_signals)} strategic signals."]
        }
