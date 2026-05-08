import json
import os
from typing import Any, Dict
from langchain_openai import ChatOpenAI

DEEP_REVIEW_PROMPT = """You are a fintech research analyst. Summarize the target company.
Return a JSON object with:
- "summary": 1 sentence company description
- "key_metrics": array of bullet strings covering funding, scale, reach
- "risks": array of bullet strings covering compliance or execution landmines
- "opportunities": array of bullet strings tailored to infrastructure gaps
- "recommended_action": 1 sentence suggesting how Blostem should engage

Company: {company}
Domain: {domain}
Additional Context: {context}

Keep it factual, less than 120 words total."""


class DeepReviewCompanyTool:
    """LLM-backed deep review callable used by the API layer."""

    def __init__(self):
        model = os.getenv("OPENAI_DEEP_REVIEW_MODEL", "gpt-4o-mini")
        temperature = float(os.getenv("OPENAI_DEEP_REVIEW_TEMPERATURE", "0.2"))
        self.llm = ChatOpenAI(model=model, temperature=temperature)

    def invoke(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        company = payload.get("company_name") or "Unknown company"
        domain = payload.get("domain") or "Unknown domain"
        context = payload.get("context") or ""
        prompt = DEEP_REVIEW_PROMPT.format(company=company, domain=domain, context=context)

        response = self.llm.invoke(prompt)
        return self._as_json(response.content)

    @staticmethod
    def _as_json(text: str) -> Dict[str, Any]:
        cleaned = text.strip().strip("`")
        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

        # Fallback minimal structure to keep frontend stable
        return {
            "summary": cleaned[:280],
            "key_metrics": [],
            "risks": [],
            "opportunities": [],
            "recommended_action": "",
        }


deep_review_company = DeepReviewCompanyTool()

__all__ = ["deep_review_company"]
