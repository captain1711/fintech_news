import os
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Tuple
import feedparser

class ResearchAgent:
    """
    Consolidated Research Agent: Handles news fetching and source prioritization.
    Formerly research_agent.py and research_tools.py.
    """
    SOURCE_CHANNELS: Dict[str, Dict] = {
        "entrackr": {
            "type": "rss",
            "name": "Entrackr",
            "url": "https://entrackr.com/feed/",
            "domain": "entrackr.com"
        },
        "tracxn": {
            "type": "rss",
            "name": "Tracxn",
            "url": "https://tracxn.com/daily-news/feed",
            "domain": "tracxn.com"
        },
        "inc42": {
            "type": "rss",
            "name": "Inc42",
            "url": "https://inc42.com/feed/",
            "domain": "inc42.com"
        },
        "yourstory": {
            "type": "rss",
            "name": "YourStory",
            "url": "https://yourstory.com/feed",
            "domain": "yourstory.com"
        },
        "rbi": {
            "type": "rss",
            "name": "RBI",
            "url": "https://rbi.org.in/rss/pressrelease.xml",
            "domain": "rbi.org.in"
        },
        "moneycontrol": {
            "type": "rss",
            "name": "Moneycontrol",
            "url": "https://www.moneycontrol.com/rss/latestnews.xml",
            "domain": "moneycontrol.com"
        },
        "economictimes": {
            "type": "rss",
            "name": "Economic Times",
            "url": "https://economictimes.indiatimes.com/rssfeedsdefault.cms",
            "domain": "economictimes.indiatimes.com"
        },
        "techcrunch": {
            "type": "rss",
            "name": "TechCrunch",
            "url": "https://techcrunch.com/feed/",
            "domain": "techcrunch.com"
        },
        "google": {
            "type": "google",
            "name": "Google News",
            "domain": ""
        },
    }

    SIGNAL_SOURCE_MAP: Dict[str, List[str]] = {
        "Funding": ["entrackr", "tracxn", "inc42", "yourstory"],
        "Regulatory": ["rbi", "moneycontrol", "economictimes"],
        "Hiring": ["google"],
        "Product": ["techcrunch", "inc42", "google"],
        "Default": ["google"],
    }

    SIGNAL_KEYWORDS: Dict[str, List[str]] = {
        "Funding": ["funding", "raises", "investment", "series", "round"],
        "Regulatory": ["rbi", "regulator", "regulatory", "compliance", "guideline"],
        "Hiring": ["hiring", "recruit", "job", "talent", "appoints"],
        "Product": ["launch", "product", "platform", "feature", "release"],
    }

    def __init__(self):
        self.name = "researcher_agent"
        self.days_back = int(os.getenv("RESEARCH_DAYS_BACK", "30"))
        self.max_articles_per_source = int(os.getenv("RESEARCH_SOURCE_LIMIT", "10"))
        
    def _rss_fetch(self, query: str, limit: int = 10) -> list:
        url = f"https://news.google.com/rss/search?q={query.replace(' ', '+')}&hl=en-IN&gl=IN&ceid=IN:en"
        feed = feedparser.parse(url)
        articles = []
        for entry in feed.entries[:limit]:
            articles.append({
                "title": entry.get("title", ""),
                "link": entry.get("link", ""),
                "published": entry.get("published", ""),
                "source_query": query,
                "source": "Google News",
            })
        return articles

    def work(self, state: dict) -> dict:
        icp = state.get("icp", "fintech india")
        industries = state.get("industries", ["Fintech"])
        signal_triggers = state.get("signal_triggers", ["Funding", "Regulatory"])

        collected, scanned_sources = self._collect_articles(industries, signal_triggers)
        messages = [f"[Researcher] Live-sourced {len(collected)} articles from {len(scanned_sources)} channels for {icp}"]
        
        return {
            "articles": collected,
            "messages": messages
        }

    def _collect_articles(self, industries: List[str], signal_triggers: List[str]) -> Tuple[List[Dict], List[str]]:
        articles: Dict[str, Dict] = {}
        scanned_sources: List[str] = []

        for signal in signal_triggers:
            normalized_signal = signal.title()
            channels = self.SIGNAL_SOURCE_MAP.get(normalized_signal, self.SIGNAL_SOURCE_MAP["Default"])
            for channel_key in channels:
                for industry in industries:
                    batch = self._fetch_from_channel(channel_key, normalized_signal, industry)
                    if batch:
                        scanned_sources.append(channel_key)
                    for item in batch:
                        articles[item["link"]] = item

        return list(articles.values()), list(dict.fromkeys(scanned_sources))

    def _fetch_from_channel(self, channel_key: str, signal: str, industry: str) -> List[Dict]:
        channel = self.SOURCE_CHANNELS.get(channel_key)
        if not channel:
            return []

        if channel["type"] == "rss":
            entries = self._read_rss(channel["url"])
            filtered = self._filter_entries(entries, signal, industry)
            if filtered:
                return [self._normalize_entry(e, channel["name"], channel_key, signal, industry) for e in filtered[:self.max_articles_per_source]]
            # Fallback to Google search scoped to domain
            domain = channel.get("domain")
            query = f"{industry} {signal} {('site:' + domain) if domain else ''}".strip()
            return self._rss_fetch(query, limit=5)

        if channel["type"] == "google":
            query = f"{industry} {signal} fintech news"
            return self._rss_fetch(query, limit=5)

        return []

    def _read_rss(self, url: str) -> List[Dict]:
        try:
            return feedparser.parse(url).entries
        except Exception:
            return []

    def _filter_entries(self, entries, signal: str, industry: str) -> List[Dict]:
        keywords = [industry.lower()] + self.SIGNAL_KEYWORDS.get(signal, [])
        horizon = datetime.now(timezone.utc) - timedelta(days=self.days_back)
        filtered = []
        for entry in entries:
            published = self._entry_datetime(entry)
            if published and published < horizon:
                continue
            text = f"{entry.get('title','')} {entry.get('summary','')}".lower()
            if any(keyword in text for keyword in keywords if keyword):
                filtered.append(entry)
        return filtered

    def _entry_datetime(self, entry) -> datetime:
        published_parsed = entry.get("published_parsed") or entry.get("updated_parsed")
        if not published_parsed:
            return datetime.now(timezone.utc)
        return datetime(*published_parsed[:6], tzinfo=timezone.utc)

    def _normalize_entry(self, entry, source_name: str, source_key: str, signal: str, industry: str) -> Dict:
        published = entry.get("published", "")
        link = entry.get("link") or entry.get("id") or ""
        return {
            "title": entry.get("title", ""),
            "link": link,
            "published": published,
            "source": source_name,
            "source_key": source_key,
            "signal_focus": signal,
            "industry_focus": industry,
            "source_query": f"{industry} {signal} {source_name}",
        }
