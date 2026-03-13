import json
from services.azure_openai import call_gpt4o

DEFAULT_SCHEMAS = {
    "ALM": [
        {"key": "reporting_date", "label": "Reporting Date", "type": "date", "include": True},
        {"key": "total_assets_cr", "label": "Total Assets (₹ Cr)", "type": "number", "include": True},
        {"key": "total_liabilities_cr", "label": "Total Liabilities (₹ Cr)", "type": "number", "include": True},
        {"key": "alm_gap_upto_1yr_cr", "label": "ALM Gap Up to 1 Year (₹ Cr)", "type": "number", "include": True},
        {"key": "alm_gap_1_3yr_cr", "label": "ALM Gap 1–3 Years (₹ Cr)", "type": "number", "include": True},
        {"key": "alm_gap_3_5yr_cr", "label": "ALM Gap 3–5 Years (₹ Cr)", "type": "number", "include": True},
        {"key": "alm_gap_5yr_plus_cr", "label": "ALM Gap >5 Years (₹ Cr)", "type": "number", "include": True},
        {"key": "lcr_pct", "label": "Liquidity Coverage Ratio (%)", "type": "number", "include": True},
        {"key": "nsfr_pct", "label": "Net Stable Funding Ratio (%)", "type": "number", "include": True},
        {"key": "interest_rate_risk_cr", "label": "Interest Rate Risk (₹ Cr)", "type": "number", "include": True},
        {"key": "alm_commentary", "label": "ALM Management Commentary", "type": "text", "include": True},
    ],
    "Shareholding": [
        {"key": "reporting_date", "label": "Reporting Date (Quarter)", "type": "date", "include": True},
        {"key": "promoter_pct", "label": "Promoter Holding (%)", "type": "number", "include": True},
        {"key": "promoter_pledged_pct", "label": "Promoter Shares Pledged (%)", "type": "number", "include": True},
        {"key": "fii_fpi_pct", "label": "FII / FPI Holding (%)", "type": "number", "include": True},
        {"key": "dii_pct", "label": "DII Holding (%)", "type": "number", "include": True},
        {"key": "public_pct", "label": "Public / Retail Holding (%)", "type": "number", "include": True},
        {"key": "total_shares", "label": "Total Shares Outstanding", "type": "number", "include": True},
        {"key": "top_shareholders", "label": "Top 10 Shareholders", "type": "table", "include": True},
        {"key": "change_from_prev_qtr", "label": "Change from Previous Quarter", "type": "text", "include": True},
    ],
    "Borrowing": [
        {"key": "report_date", "label": "Report Date", "type": "date", "include": True},
        {"key": "total_debt_cr", "label": "Total Debt (₹ Cr)", "type": "number", "include": True},
        {"key": "secured_debt_cr", "label": "Secured Debt (₹ Cr)", "type": "number", "include": True},
        {"key": "unsecured_debt_cr", "label": "Unsecured Debt (₹ Cr)", "type": "number", "include": True},
        {"key": "debt_equity_ratio", "label": "Debt / Equity Ratio", "type": "number", "include": True},
        {"key": "wacd_pct", "label": "Wtd. Avg. Cost of Debt (%)", "type": "number", "include": True},
        {"key": "lender_breakdown", "label": "Lender-wise Breakdown", "type": "table", "include": True},
        {"key": "repayment_schedule", "label": "Repayment Schedule by Year", "type": "table", "include": True},
        {"key": "covenants", "label": "Key Financial Covenants", "type": "text", "include": True},
        {"key": "fldg_details", "label": "FLDG / Guarantee Details", "type": "text", "include": True},
    ],
    "AnnualReport": [
        {"key": "fy_year", "label": "Financial Year", "type": "text", "include": True},
        {"key": "revenue_cr", "label": "Total Revenue / NII (₹ Cr)", "type": "number", "include": True},
        {"key": "revenue_growth_pct", "label": "Revenue Growth (%)", "type": "number", "include": True},
        {"key": "ebitda_cr", "label": "EBITDA (₹ Cr)", "type": "number", "include": True},
        {"key": "ebitda_margin_pct", "label": "EBITDA Margin (%)", "type": "number", "include": True},
        {"key": "pat_cr", "label": "Profit After Tax (₹ Cr)", "type": "number", "include": True},
        {"key": "pat_margin_pct", "label": "PAT Margin (%)", "type": "number", "include": True},
        {"key": "total_assets_cr", "label": "Total Assets (₹ Cr)", "type": "number", "include": True},
        {"key": "net_worth_cr", "label": "Net Worth (₹ Cr)", "type": "number", "include": True},
        {"key": "cash_from_ops_cr", "label": "Cash from Operations (₹ Cr)", "type": "number", "include": True},
        {"key": "icr", "label": "Interest Coverage Ratio", "type": "number", "include": True},
        {"key": "current_ratio", "label": "Current Ratio", "type": "number", "include": True},
        {"key": "roe_pct", "label": "Return on Equity (%)", "type": "number", "include": True},
        {"key": "roa_pct", "label": "Return on Assets (%)", "type": "number", "include": True},
        {"key": "debt_equity_ratio", "label": "Debt / Equity Ratio", "type": "number", "include": True},
    ],
    "Portfolio": [
        {"key": "reporting_date", "label": "Reporting Date", "type": "date", "include": True},
        {"key": "total_aum_cr", "label": "Total AUM / Portfolio (₹ Cr)", "type": "number", "include": True},
        {"key": "aum_growth_pct", "label": "AUM Growth YoY (%)", "type": "number", "include": True},
        {"key": "gross_npa_pct", "label": "Gross NPA (%)", "type": "number", "include": True},
        {"key": "net_npa_pct", "label": "Net NPA (%)", "type": "number", "include": True},
        {"key": "pcr_pct", "label": "Provision Coverage Ratio (%)", "type": "number", "include": True},
        {"key": "collection_efficiency_pct", "label": "Collection Efficiency (%)", "type": "number", "include": True},
        {"key": "car_pct", "label": "Capital Adequacy Ratio (%)", "type": "number", "include": True},
        {"key": "tier1_capital_pct", "label": "Tier 1 Capital Ratio (%)", "type": "number", "include": True},
        {"key": "yield_pct", "label": "Portfolio Yield (%)", "type": "number", "include": True},
        {"key": "nim_pct", "label": "Net Interest Margin (%)", "type": "number", "include": True},
        {"key": "sector_exposure", "label": "Sector-wise Exposure", "type": "table", "include": True},
        {"key": "vintage_analysis", "label": "Vintage Analysis", "type": "table", "include": True},
        {"key": "top10_borrowers", "label": "Top 10 Borrower Concentration", "type": "table", "include": True},
    ],
}

EXTRACTION_PROMPT = """You are a financial data extraction expert for Indian credit analysis.

Document Type: {doc_type}

Extracted Text (first 4500 characters):
{text}

Extracted Tables (first 6 tables as JSON):
{tables}

Extract EXACTLY the following fields. Rules:
- For number fields: return numeric values only (no ₹, no commas, no % sign)
- For date fields: return ISO format YYYY-MM-DD or YYYY-MM if only month known
- For table fields: return array of objects e.g. [{{"Lender": "SBI", "Amount": 100.5}}, ...]
- For text fields: return relevant verbatim text from the document
- If a field cannot be found: return null
- Do NOT invent or estimate values — if not in document, return null

Fields to extract:
{fields_desc}

Respond ONLY in JSON with exactly these keys plus:
"_confidence": 0.0-1.0 (overall extraction confidence across all fields)
"_missing_fields": ["field_key1", "field_key2"] (list of keys that returned null)
"_notes": "any important caveats about the extraction" """


async def extract_with_schema(doc_type: str, raw_text: str, raw_tables: list, schema_fields: list) -> dict:
    active_fields = [f for f in schema_fields if f.get("include", True)]
    fields_desc = "\n".join([
        f'- "{f["key"]}": {f["label"]} (type: {f["type"]})'
        for f in active_fields
    ])
    tables_str = json.dumps(raw_tables[:6], indent=2)[:3500] if raw_tables else "[]"

    prompt = EXTRACTION_PROMPT.format(
        doc_type=doc_type,
        text=raw_text[:4500] if raw_text else "",
        tables=tables_str,
        fields_desc=fields_desc,
    )

    result = await call_gpt4o(prompt)
    return json.loads(result)
