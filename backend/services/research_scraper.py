import json
from services.azure_openai import call_gpt4o
from config import settings


class ResearchScraper:

    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None:
            try:
                from tavily import TavilyClient
                if "placeholder" not in settings.tavily_api_key.lower():
                    self._client = TavilyClient(api_key=settings.tavily_api_key)
            except Exception:
                self._client = None
        return self._client

    async def research_entity(self, company_name: str, cin: str, sector: str, sub_sector: str) -> dict:
        import asyncio

        print(f"DEBUG: Starting research for {company_name}")
        client = self._get_client()
        if client is None:
            print("DEBUG: No Tavily client, using mock")
            return self._mock_research(company_name, sector)

        # REDUCED: Only 2 basic queries (1 credit each)
        queries = [
            f"{company_name} {cin} financial news legal cases NPA fraud India 2024-2025",
            f"India {sector} {sub_sector} industry outlook trends 2025 growth credit risk",
        ]

        raw_results = []
        
        # Parallel execution of the 2 queries
        print(f"DEBUG: Running 2 parallel Tavily searches")
        tasks = [
            asyncio.to_thread(client.search, query=q, search_depth="basic", max_results=10)
            for q in queries
        ]
        
        try:
            responses = await asyncio.gather(*tasks)
            for i, response in enumerate(responses):
                res_list = response.get("results", [])
                print(f"DEBUG: Query {i+1} got {len(res_list)} results")
                raw_results.extend(res_list)
        except Exception as e:
            print(f"DEBUG: Parallel Tavily Error: {e}")

        # Categorize results for the analyzer
        news = []
        legal = []
        macro = []

        print(f"DEBUG: Processing {len(raw_results)} total raw results")
        legal_keywords = ["court", "nclt", "fraud", "defaulter", "penalty", "sebi", "rbi", "mca", "legal", "lawsuit", "case"]
        macro_keywords = ["outlook", "trends", "industry", "sector", "growth", "gdp", "market", "policy"]

        for r in raw_results:
            content = r.get("content", "")
            title = r.get("title", "").lower()
            item = {
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "content": content[:800],
                "score": r.get("score", 0),
                "published": r.get("published_date", ""),
            }

            if any(k in title or k in content.lower()[:200] for k in legal_keywords):
                item["category"] = "legal"
                legal.append(item)
            elif any(k in title or k in content.lower()[:200] for k in macro_keywords):
                item["category"] = "macro"
                macro.append(item)
            else:
                item["category"] = "news"
                news.append(item)

        news = self._deduplicate(news, limit=6)
        legal = self._deduplicate(legal, limit=4)
        macro = self._deduplicate(macro, limit=4)

        print(f"DEBUG: Categorized: news={len(news)}, legal={len(legal)}, macro={len(macro)}")
        all_text = self._flatten_results(news + legal)
        sentiment = await self._analyze_sentiment(all_text, company_name, sector)

        print(f"DEBUG: Research complete for {company_name}")
        return {
            "news": news,
            "legal": legal,
            "macro": macro,
            "sentiment": sentiment,
        }

    def _deduplicate(self, results: list, limit: int) -> list:
        seen = set()
        deduped = []
        for r in sorted(results, key=lambda x: x["score"], reverse=True):
            if r["url"] not in seen:
                seen.add(r["url"])
                deduped.append(r)
        return deduped[:limit]

    def _flatten_results(self, results: list) -> str:
        lines = []
        for r in results[:12]:
            lines.append(f"Title: {r['title']}")
            lines.append(f"Content: {r['content'][:300]}")
            lines.append("---")
        return "\n".join(lines)

    async def _analyze_sentiment(self, articles_text: str, company_name: str, sector: str) -> dict:
        if not articles_text:
            return {
                "overall_sentiment": "NEUTRAL",
                "sentiment_score": 0,
                "positive_signals": [],
                "risk_signals": [],
                "red_flags": [],
                "legal_concerns": [],
                "sector_outlook": "N/A",
                "media_summary": "No recent media coverage found to analyze."
            }

        prompt = f"""Analyse these news and legal articles about {company_name}
(sector: {sector}) for credit risk assessment.

Articles:
{articles_text[:3500]}

Respond ONLY in JSON:
{{
  "overall_sentiment": "POSITIVE|NEUTRAL|NEGATIVE",
  "sentiment_score": -1.0,
  "positive_signals": ["signal1", "signal2"],
  "risk_signals": ["risk1", "risk2"],
  "red_flags": ["redflag1"],
  "legal_concerns": ["concern1"],
  "sector_outlook": "One paragraph on sector tailwinds/headwinds",
  "media_summary": "One paragraph summarising the entity's media presence"
}}"""
        print(f"DEBUG: Calling GPT-4o for sentiment analysis on {len(articles_text)} chars")
        result = await call_gpt4o(prompt)
        print("DEBUG: GPT-4o sentiment analysis complete")
        return json.loads(result)

    def _mock_research(self, company_name: str, sector: str) -> dict:
        mock_news = [
            {
                "title": f"{company_name} posts 14% revenue growth in Q3 FY2024",
                "url": "https://economictimes.indiatimes.com/sample-article",
                "content": f"{company_name} reported a 14% year-on-year growth in revenue for Q3 FY2024, driven by robust loan disbursements in the MSME segment. NPA levels remained stable at 3.2%.",
                "score": 0.92,
                "published": "2024-02-15",
                "category": "news"
            },
            {
                "title": f"RBI maintains status quo; {sector} NBFCs to benefit",
                "url": "https://livemint.com/sample-article",
                "content": f"RBI's decision to hold rates benefits {sector} lending companies including entities like {company_name}. Analysts expect NIM expansion in coming quarters.",
                "score": 0.85,
                "published": "2024-02-08",
                "category": "news"
            }
        ]
        mock_legal = [
            {
                "title": f"No adverse legal records found for {company_name}",
                "url": "https://mca.gov.in/sample",
                "content": f"MCA records show {company_name} is in good standing with no pending winding-up petitions or director disqualifications.",
                "score": 0.78,
                "category": "legal"
            }
        ]
        mock_macro = [
            {
                "title": f"India {sector} Sector Outlook 2025: Stable Growth Expected",
                "url": "https://business-standard.com/sample",
                "content": f"The Indian {sector} sector is expected to grow at 12-15% in FY2025, supported by strong credit demand from MSMEs and retail borrowers.",
                "score": 0.88,
                "category": "macro"
            }
        ]
        mock_sentiment = {
            "overall_sentiment": "POSITIVE",
            "sentiment_score": 0.3,
            "positive_signals": ["Consistent revenue growth", "Stable NPA levels", "RBI policy tailwinds"],
            "risk_signals": ["Interest rate sensitivity", "Competitive pressure from banks"],
            "red_flags": [],
            "legal_concerns": [],
            "sector_outlook": f"The {sector} sector in India is showing resilience with steady credit demand. RBI's cautious stance on rates benefits established players while keeping margin pressures in check.",
            "media_summary": f"{company_name} maintains a positive media presence with coverage focused on growth metrics and stable asset quality. No adverse news detected."
        }
        return {
            "news": mock_news,
            "legal": mock_legal,
            "macro": mock_macro,
            "sentiment": mock_sentiment
        }


scraper = ResearchScraper()
