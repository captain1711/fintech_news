import time, json, os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
from googlesearch import search as gsearch
from langchain_openai import ChatOpenAI

class EnricherAgent:
    """
    Consolidated Enricher Agent: Performs deep website scraping and entity lookup.
    Formerly enrichment_agent.py and enrichment_tools.py.
    """
    def __init__(self):
        self.name = "enricher"
        self.llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)

    def get_headless_driver(self):
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        service = Service(ChromeDriverManager().install())
        return webdriver.Chrome(service=service, options=chrome_options)

    def scrape_company(self, company_name: str, domain: str = None) -> dict:
        url = f"https://{domain}" if domain else None
        if not url:
            try: url = list(gsearch(company_name, num_results=1))[0]
            except: return {}

        driver = self.get_headless_driver()
        try:
            driver.get(url)
            time.sleep(2)
            soup = BeautifulSoup(driver.page_source, "html.parser")
            text = soup.get_text(separator=" ", strip=True)[:3000]
            return {"scraped_text": text, "url": url}
        except: return {}
        finally: driver.quit()

    def work(self, state: dict) -> dict:
        signals = state.get("signals", [])
        # Group signals by company
        accounts = {}
        for s in signals:
            name = s.get("company", "Unknown")
            if name not in accounts:
                accounts[name] = {
                    "company": name,
                    "signals": [],
                    "organization_type": s.get("organization_type"),
                    "top_intent_score": 0,
                    "signal_count": 0
                }
            accounts[name]["signals"].append(s)
            accounts[name]["signal_count"] += 1
            accounts[name]["top_intent_score"] = max(accounts[name]["top_intent_score"], s.get("intent_score", 0))

        # Enrich top 5
        top_names = sorted(accounts.keys(), key=lambda x: accounts[x]["top_intent_score"], reverse=True)[:5]
        for name in top_names:
            enrichment = self.scrape_company(name)
            accounts[name]["enrichment"] = enrichment

        return {
            "accounts": accounts,
            "messages": [f"[Enricher] Grouped signals into {len(accounts)} accounts and deep-scanned top 5."]
        }
