import json
from services.azure_openai import call_gpt4o

VALID_TYPES = ["ALM", "Shareholding", "Borrowing", "AnnualReport", "Portfolio"]

CLASSIFICATION_PROMPT = """You are a financial document classifier for Indian credit analysis.

Filename: {filename}
Extracted Text (first 2500 characters):
{text}

Tables detected: {table_count}
First table headers (if any): {table_headers}

Classify this document into EXACTLY ONE of these types:

- ALM: Asset-Liability Management. Contains maturity buckets (1 day, 2-7 days, 8-14 days etc.),
  ALM gaps, interest rate sensitivity, liquidity coverage ratio, NSFR.

- Shareholding: Shareholding pattern. Contains promoter/FII/DII/public percentage holdings,
  shareholder names with share counts, pledged shares, quarterly shareholding data.

- Borrowing: Borrowing profile / debt schedule. Contains lender names, loan amounts outstanding,
  interest rates, repayment schedules, secured vs unsecured split, FLDG/guarantee details.

- AnnualReport: Annual report financial statements. Contains P&L (revenue, EBITDA, PAT),
  Balance Sheet (assets, liabilities, net worth), Cash Flow Statement, auditor's report,
  notes to accounts, director's report.

- Portfolio: Portfolio / performance data. Contains AUM breakdown, NPA percentages (Gross/Net),
  provision coverage ratio, collection efficiency, sector-wise exposure, vintage analysis,
  capital adequacy ratio.

Respond ONLY in this exact JSON format:
{{
  "predicted_type": "ALM|Shareholding|Borrowing|AnnualReport|Portfolio",
  "confidence": 0.0,
  "reasoning": "One sentence explaining the strongest signal that determined the classification",
  "key_signals": ["exact phrase or number found that confirms this type", "second signal", "third signal"]
}}"""


async def classify_document(filename: str, raw_text: str, raw_tables: list) -> dict:
    table_headers = ""
    if raw_tables:
        first_table = raw_tables[0]
        if first_table:
            table_headers = str(first_table[0])[:200]

    prompt = CLASSIFICATION_PROMPT.format(
        filename=filename,
        text=raw_text[:2500] if raw_text else "",
        table_count=len(raw_tables) if raw_tables else 0,
        table_headers=table_headers,
    )

    result = await call_gpt4o(prompt)
    data = json.loads(result)

    if data.get("predicted_type") not in VALID_TYPES:
        data["predicted_type"] = "AnnualReport"
        data["confidence"] = 0.3

    return data
