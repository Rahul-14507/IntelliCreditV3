import json
from openai import AsyncAzureOpenAI
from config import settings

client = AsyncAzureOpenAI(
    azure_endpoint=settings.azure_openai_endpoint,
    api_key=settings.azure_openai_key,
    api_version="2024-02-01",
)


async def call_gpt4o(prompt: str, max_tokens: int = 1500) -> str:
    """Call Azure OpenAI GPT-4o with JSON mode. Falls back to a mock if API key is placeholder."""
    if "placeholder" in settings.azure_openai_key.lower():
        # Return mock JSON for local testing without an API key
        return _mock_response(prompt)

    response = await client.chat.completions.create(
        model=settings.azure_openai_deployment,
        temperature=0,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content


def _mock_response(prompt: str) -> str:
    """Return plausible mock JSON based on the type of prompt."""
    if "predicted_type" in prompt or "Classify this document" in prompt:
        return json.dumps({
            "predicted_type": "AnnualReport",
            "confidence": 0.85,
            "reasoning": "Document contains financial statements and P&L data typical of annual reports.",
            "key_signals": ["Revenue", "EBITDA", "Balance Sheet", "Auditor's Report"]
        })
    elif "sentiment" in prompt.lower() and "overall_sentiment" in prompt:
        return json.dumps({
            "overall_sentiment": "NEUTRAL",
            "sentiment_score": 0.1,
            "positive_signals": ["Strong market position", "Consistent revenue growth"],
            "risk_signals": ["Elevated NPA levels", "Rising interest rates"],
            "red_flags": [],
            "legal_concerns": [],
            "sector_outlook": "The NBFC sector shows moderate growth with RBI maintaining cautious monetary stance.",
            "media_summary": "The company has maintained a low media profile with no major controversies."
        })
    elif "credit assessment" in prompt.lower() or "recommendation" in prompt:
        return json.dumps({
            "scores": {
                "financial_health": 72,
                "asset_quality": 68,
                "governance": 75,
                "liquidity_alm": 70,
                "market_position": 65,
                "overall": 70
            },
            "score_rationale": {
                "financial_health": "Revenue growth is steady at 12% YoY with healthy PAT margins.",
                "asset_quality": "Gross NPA at 3.2% is within acceptable range for the sector.",
                "governance": "Promoter holding is stable at 52% with no pledged shares.",
                "liquidity_alm": "LCR above 120% indicates comfortable short-term liquidity position.",
                "market_position": "Company has strong regional presence but faces competitive pressure."
            },
            "grade": "B",
            "recommendation": "CONDITIONAL_APPROVE",
            "recommended_limit_cr": 45.0,
            "recommended_rate_pct": 11.5,
            "recommended_tenure_months": 48,
            "conditions": [
                "Quarterly financial reporting mandatory",
                "Maintain DSCR above 1.2x throughout tenure",
                "No further dilution of promoter holding below 45%"
            ],
            "reasoning_chain": [
                {"step": 1, "factor": "Financial Health", "evidence": "Revenue ₹450 Cr, PAT margin 8.5%, EBITDA margin 22%", "signal": "POSITIVE", "impact": "HIGH", "weight": "30%"},
                {"step": 2, "factor": "Asset Quality & Portfolio", "evidence": "Gross NPA 3.2%, Net NPA 1.8%, PCR 78%", "signal": "NEUTRAL", "impact": "HIGH", "weight": "20%"},
                {"step": 3, "factor": "Governance & Shareholding", "evidence": "Promoter 52%, no pledging, independent board majority", "signal": "POSITIVE", "impact": "MEDIUM", "weight": "20%"},
                {"step": 4, "factor": "Liquidity & ALM", "evidence": "LCR 125%, positive ALM gap in 1-3yr bucket", "signal": "POSITIVE", "impact": "MEDIUM", "weight": "15%"},
                {"step": 5, "factor": "Market Position & Sector", "evidence": "Regional NBFC with 8% market share in target segment", "signal": "NEUTRAL", "impact": "LOW", "weight": "15%"},
                {"step": 6, "factor": "External Research & Red Flags", "evidence": "No adverse news, sector outlook cautiously optimistic", "signal": "NEUTRAL", "impact": "LOW", "weight": "overlay"},
                {"step": 7, "factor": "Cross-Document Triangulation", "evidence": "Revenue figures consistent across Annual Report and ALM statement", "signal": "POSITIVE", "impact": "LOW", "weight": "overlay"}
            ],
            "swot": {
                "strengths": ["Diversified loan book", "Strong CAR at 18%", "Experienced management team", "Low wholesale funding dependency"],
                "weaknesses": ["Moderate NPA levels", "Geographic concentration risk", "High cost of funds vs peers"],
                "opportunities": ["MSME lending expansion", "Digital lending platform growth", "Rural market penetration"],
                "threats": ["RBI tightening norms for NBFCs", "Rising interest rate environment", "Competitive pressure from banks"]
            },
            "triangulation": {
                "revenue_consistency": "Annual report revenue of ₹450 Cr aligns with ALM asset size of ₹2,200 Cr at 8% yield — consistent",
                "debt_consistency": "Borrowing profile total ₹1,800 Cr matches balance sheet debt — consistent",
                "npa_commentary_alignment": "Portfolio NPA at 3.2% aligns with management commentary tone — aligned",
                "shareholding_governance": "Promoter pledging at 0% indicates low governance risk",
                "overall_consistency_score": 85,
                "inconsistencies": []
            },
            "key_risks": ["NPA trajectory risk amid rising rates", "Concentration risk in top 10 borrowers", "Liquidity mismatch in >5yr bucket", "Regulatory compliance risk", "Margin compression risk"],
            "mitigants": ["Strong capital adequacy buffer at 18%", "Diversified funding mix", "Experienced risk management team"],
            "executive_summary": "The company is a mid-sized NBFC with consistent revenue growth and manageable asset quality metrics. Financial health scores are adequate with PAT margins at 8.5% and EBITDA at 22%. Primary risks include NPA trajectory and sector-wide rate headwinds. External research via Tavily shows no material adverse news or legal concerns. Based on comprehensive analysis, we recommend CONDITIONAL APPROVAL for ₹45 Cr term loan at 11.5% for 48 months, subject to quarterly reporting covenants and DSCR maintenance above 1.2x."
        })
    else:
        # Generic extraction response
        return json.dumps({
            "fy_year": "FY2024",
            "revenue_cr": 450.5,
            "revenue_growth_pct": 12.3,
            "ebitda_cr": 99.1,
            "ebitda_margin_pct": 22.0,
            "pat_cr": 38.3,
            "pat_margin_pct": 8.5,
            "total_assets_cr": 2200.0,
            "net_worth_cr": 380.0,
            "cash_from_ops_cr": 55.2,
            "icr": 3.2,
            "current_ratio": 1.4,
            "roe_pct": 10.1,
            "roa_pct": 1.7,
            "debt_equity_ratio": 4.7,
            "_confidence": 0.82,
            "_missing_fields": [],
            "_notes": "Mock extraction — Azure OpenAI API key not configured"
        })
