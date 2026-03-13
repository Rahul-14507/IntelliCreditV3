import os
from config import settings


class DocumentExtractor:
    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None:
            try:
                from azure.ai.formrecognizer import DocumentAnalysisClient
                from azure.core.credentials import AzureKeyCredential
                self._client = DocumentAnalysisClient(
                    endpoint=settings.azure_di_endpoint,
                    credential=AzureKeyCredential(settings.azure_di_key),
                )
            except Exception:
                self._client = None
        return self._client

    async def extract(self, file_path: str) -> dict:
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._extract_sync, file_path)

    def _extract_sync(self, file_path: str) -> dict:
        client = self._get_client()

        # If Azure DI client unavailable (no key), do basic text extraction
        if client is None:
            return self._fallback_extract(file_path)

        try:
            with open(file_path, "rb") as f:
                poller = client.begin_analyze_document("prebuilt-layout", f)
            result = poller.result()

            full_text = "\n".join(
                line.content
                for page in result.pages
                for line in page.lines
            )

            tables = []
            for table in result.tables:
                rows = table.row_count
                cols = table.column_count
                grid = [[""] * cols for _ in range(rows)]
                for cell in table.cells:
                    grid[cell.row_index][cell.column_index] = cell.content
                tables.append(grid)

            return {
                "full_text": full_text,
                "tables": tables,
                "page_count": len(result.pages),
                "char_count": len(full_text),
            }
        except Exception as e:
            return self._fallback_extract(file_path)

    def _fallback_extract(self, file_path: str) -> dict:
        """Basic text extraction without Azure DI — works for .txt and simple files."""
        ext = os.path.splitext(file_path)[1].lower()
        full_text = ""
        tables = []

        try:
            if ext in (".txt", ".csv"):
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    full_text = f.read()
                if ext == ".csv":
                    import csv
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        reader = csv.reader(f)
                        tables = [list(reader)]
            elif ext in (".pdf",):
                # Try pdfminer or just return placeholder
                try:
                    import subprocess
                    result = subprocess.run(
                        ["python", "-c",
                         f"import sys; "
                         f"exec(\"try:\\n from pdfminer.high_level import extract_text\\n print(extract_text('{file_path}'))\\nexcept: print('')\")"],
                        capture_output=True, text=True, timeout=30
                    )
                    full_text = result.stdout
                except Exception:
                    full_text = f"[Extracted from {os.path.basename(file_path)} — Azure DI required for full extraction]"
            else:
                full_text = f"[File: {os.path.basename(file_path)} — Azure DI required for full extraction]"
        except Exception:
            full_text = f"[Error reading {os.path.basename(file_path)}]"

        return {
            "full_text": full_text,
            "tables": tables,
            "page_count": 1,
            "char_count": len(full_text),
        }


extractor = DocumentExtractor()
