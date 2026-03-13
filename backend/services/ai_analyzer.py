import json
from services.azure_openai import call_gpt4o

ANALYSIS_PROMPT = """You are a senior credit committee member at a leading Indian commercial bank.
Perform a complete investment-grade credit assessment for a loan application.

═══════════════════════════════════════════
ENTITY PROFILE
═══════════════════════════════════════════
Company:        {company_name}
CIN:            {cin}
Sector:         {sector} / {sub_sector}
Est. Turnover:  ₹{turnover} Cr
Credit Rating:  {credit_rating}
(Apply SECTOR-SPECIFIC BENCHMARKS where applicable:
- For NBFCs: D/E up to 4.0x is normal (RBI allows 5x). 2.02x = STRONG.
- For NBFCs: Negative operating CFO during growth phase is EXPECTED. Evaluate DSCR instead.
- For NBFCs: GNPA < 3% = good. < 2% = excellent. 2.1% = GOOD.
- For NBFCs: NIM > 6% = healthy. 7.2% = STRONG.
- CRAR 19.4% vs 15% minimum = very well capitalised.)

LOAN REQUEST
Type:           {loan_type}
Amount:         ₹{loan_amount} Cr
Tenure:         {tenure} months
Purpose:        {loan_purpose}
Collateral:     {collateral}

═══════════════════════════════════════════
FIELD OBSERVATIONS / PRIMARY INSIGHTS
═══════════════════════════════════════════
{field_observations}

═══════════════════════════════════════════
EXTRACTED DOCUMENT DATA
═══════════════════════════════════════════
{extracted_data}

═══════════════════════════════════════════
SECONDARY RESEARCH (Tavily)
═══════════════════════════════════════════
Sentiment:      {sentiment_overall} (score: {sentiment_score})
Positive:       {positive_signals}
Risk Signals:   {risk_signals}
Red Flags:      {red_flags}
Legal Concerns: {legal_concerns}
Sector Outlook: {sector_outlook}
═══════════════════════════════════════════

Provide your complete credit assessment. Respond ONLY in JSON:

IMPORTANT: All scores MUST be integers between 0 and 100. 
Do NOT use a 1-10 scale. An average company scores 50. 
A strong company scores 75-85. An exceptional company scores 90+.

{
  "scores": {
    "financial_health":   <integer 0-100. 50=average, 70=good, 85=strong, 95=exceptional>,
    "asset_quality":      <integer 0-100. 50=average, 70=good, 85=strong, 95=exceptional>,
    "governance":         <integer 0-100. 50=average, 70=good, 85=strong, 95=exceptional>,
    "liquidity_alm":      <integer 0-100. 50=average, 70=good, 85=strong, 95=exceptional>,
    "market_position":    <integer 0-100. 50=average, 70=good, 85=strong, 95=exceptional>,
    "overall":            <weighted average of above as integer 0-100>
  },
  "score_rationale": {
    "financial_health":   "2 sentence rationale",
    "asset_quality":      "2 sentence rationale",
    "governance":         "2 sentence rationale",
    "liquidity_alm":      "2 sentence rationale",
    "market_position":    "2 sentence rationale"
  },
  "grade":            "A|B|C|D",
  "recommendation":   "APPROVE|CONDITIONAL_APPROVE|REJECT",
  "recommended_limit_cr":      0,
  "recommended_rate_pct":      0,
  "recommended_tenure_months": 0,
  "conditions": ["Condition 1", "Condition 2"],
  "reasoning_chain": [
    {"step": 1, "factor": "Financial Health", "evidence": "...", "signal": "POSITIVE|NEUTRAL|NEGATIVE", "impact": "HIGH|MEDIUM|LOW", "weight": "30%"},
    {"step": 2, "factor": "Asset Quality & Portfolio", "evidence": "...", "signal": "...", "impact": "...", "weight": "20%"},
    {"step": 3, "factor": "Governance & Shareholding", "evidence": "...", "signal": "...", "impact": "...", "weight": "20%"},
    {"step": 4, "factor": "Liquidity & ALM", "evidence": "...", "signal": "...", "impact": "...", "weight": "15%"},
    {"step": 5, "factor": "Market Position & Sector", "evidence": "...", "signal": "...", "impact": "...", "weight": "15%"},
    {"step": 6, "factor": "External Research & Red Flags", "evidence": "...", "signal": "...", "impact": "...", "weight": "overlay"},
    {"step": 7, "factor": "Cross-Document Triangulation", "evidence": "...", "signal": "...", "impact": "...", "weight": "overlay"}
  ],
  "swot": {
    "strengths":     ["S1", "S2", "S3", "S4"],
    "weaknesses":    ["W1", "W2", "W3"],
    "opportunities": ["O1", "O2", "O3"],
    "threats":       ["T1", "T2", "T3"]
  },
  "triangulation": {
    "revenue_consistency":      "...",
    "debt_consistency":         "...",
    "npa_commentary_alignment": "...",
    "shareholding_governance":  "...",
    "overall_consistency_score": 0,
    "inconsistencies":          []
  },
  "document_consistency": {
    "overall_consistency_score": <integer 0-100>,
    "checks_performed": [
      {
        "check_name": "Revenue Consistency",
        "document_a": "Annual Report/P&L",
        "document_b": "GST Filings", 
        "value_a": "...",
        "value_b": "...",
        "variance_pct": 0,
        "status": "CONSISTENT|MINOR_VARIANCE|MAJOR_VARIANCE|UNABLE_TO_CHECK",
        "flag": "..."
      }
    ],
    "red_flags": [],
    "summary": "..."
  },
  "key_risks":  ["risk1", "risk2", "risk3", "risk4", "risk5"],
  "mitigants":  ["mitigant1", "mitigant2", "mitigant3"],
  "executive_summary": "4-5 sentence credit committee summary."
}

DOCUMENT CONSISTENCY CHECKS — perform all of these cross-document verifications:
1. Revenue Consistency: Compare revenue declared in annual report/P&L vs revenue implied by total GST taxable turnover (multiply monthly average by 12). Flag if variance > 10%.
2. Director Consistency: Check if director names mentioned in different documents match each other. Flag any name appearing in one document but not another.
3. Debt Consistency: Compare total debt in balance sheet vs loan amounts mentioned in banking details or sanction letters. Flag if variance > 5%.
4. Profit Consistency: Check if net profit in P&L is consistent with retained earnings movement in balance sheet. Flag if inconsistent.
5. If any check cannot be performed because the relevant documents were not uploaded, mark status as UNABLE_TO_CHECK — do not penalize the score for missing documents.

For overall_consistency_score: start 100, deduct 15 per MAJOR_VARIANCE, 5 per MINOR_VARIANCE.
"""


async def analyze_entity(entity, all_extracted: list, research: dict) -> dict:
    extracted_summary = ""
    for doc in all_extracted:
        extracted_summary += f"\n[{doc['doc_type']} — {doc['filename']}]\n"
        if doc.get("extracted"):
            for k, v in doc["extracted"].items():
                if not k.startswith("_") and v is not None:
                    extracted_summary += f"  {k}: {v}\n"

    sentiment = research.get("sentiment", {})
    prompt = ANALYSIS_PROMPT
    replacements = {
        "{company_name}": entity.company_name,
        "{cin}": entity.cin or "N/A",
        "{sector}": entity.sector or "N/A",
        "{sub_sector}": entity.sub_sector or "N/A",
        "{turnover}": str(entity.annual_turnover_cr or "N/A"),
        "{credit_rating}": entity.credit_rating or "Unrated",
        "{loan_type}": entity.loan_type or "Term Loan",
        "{loan_amount}": str(entity.loan_amount_cr),
        "{tenure}": str(entity.loan_tenure_months or "N/A"),
        "{loan_purpose}": entity.loan_purpose or "N/A",
        "{collateral}": entity.collateral or "N/A",
        "{field_observations}": entity.field_observations or "No field observations provided.",
        "{extracted_data}": extracted_summary[:5000],
        "{sentiment_overall}": sentiment.get("overall_sentiment", "N/A"),
        "{sentiment_score}": str(sentiment.get("sentiment_score", 0)),
        "{positive_signals}": str(sentiment.get("positive_signals", [])),
        "{risk_signals}": str(sentiment.get("risk_signals", [])),
        "{red_flags}": str(sentiment.get("red_flags", [])),
        "{legal_concerns}": str(sentiment.get("legal_concerns", [])),
        "{sector_outlook}": sentiment.get("sector_outlook", "N/A"),
    }

    for k, v in replacements.items():
        prompt = prompt.replace(k, str(v))

    result = await call_gpt4o(prompt, max_tokens=3000)
    return json.loads(result)
