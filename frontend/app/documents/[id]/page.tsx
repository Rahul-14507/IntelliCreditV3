"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getEntity, uploadDocs, listDocs, extractAll, classifyAll, docStatus } from "@/lib/api";
import { Entity, Document } from "@/lib/types";

const DOC_TYPE_HINTS = [
  { icon: "📊", label: "ALM Statement", desc: "Asset-Liability Management / Maturity profile" },
  { icon: "👥", label: "Shareholding Pattern", desc: "Quarterly shareholding data from BSE/NSE" },
  { icon: "💳", label: "Borrowing Profile", desc: "Debt schedule / lender-wise breakdown" },
  { icon: "📋", label: "Annual Report", desc: "P&L, Balance Sheet, Cash Flow Statement" },
  { icon: "📈", label: "Portfolio Statement", desc: "AUM, NPA, Collection efficiency data" },
];

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

interface DocStatus {
  extraction_status: string;
  page_count?: number;
}

export default function DocumentsPage() {
  const router = useRouter();
  const params = useParams();
  const entityId = params.id as string;

  const [entity, setEntity] = useState<Entity | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const startPolling = useCallback((docId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await docStatus(entityId, docId) as DocStatus;
        setDocs((prev) =>
          prev.map((d) =>
            d.id === docId
              ? { ...d, extraction_status: status.extraction_status as Document["extraction_status"], page_count: status.page_count }
              : d
          )
        );
        if (status.extraction_status !== "extracting") {
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [entityId]);

  const loadDocs = useCallback(async () => {
    const d = await listDocs(entityId) as Document[];
    setDocs(d);
    d.filter((doc) => doc.extraction_status === "extracting").forEach((doc) => startPolling(doc.id));
  }, [entityId, startPolling]);

  useEffect(() => {
    getEntity(entityId).then((e) => setEntity(e as Entity));
    loadDocs();
  }, [entityId, loadDocs]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      await uploadDocs(entityId, files);
      await loadDocs();
    } catch {
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleExtractAll() {
    setExtracting(true);
    try {
      await extractAll(entityId);
      const d = await listDocs(entityId) as Document[];
      setDocs(d);
      d.filter((doc) => doc.extraction_status === "extracting").forEach((doc) => startPolling(doc.id));
    } catch {
      alert("Extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  async function handleClassifyAndProceed() {
    setClassifying(true);
    try {
      await classifyAll(entityId);
      router.push(`/schema/${entityId}`);
    } catch {
      alert("Classification failed");
      setClassifying(false);
    }
  }

  const allExtracted = docs.length > 0 && docs.every((d) => d.extraction_status === "done");
  const anyPending = docs.some((d) => d.extraction_status === "pending");

  const statusBadge = (status: string) => {
    const m: Record<string, { cls: string; label: string }> = {
      pending: { cls: "badge-gray", label: "Pending" },
      extracting: { cls: "badge-conditional", label: "Extracting..." },
      done: { cls: "badge-approve", label: "Extracted" },
      error: { cls: "badge-reject", label: "Error" },
    };
    return m[status] || m.pending;
  };

  return (
    <div className="min-h-screen">
      <header className="glass border-b border-white/5 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push("/")} className="text-white/40 hover:text-white transition-colors text-sm">
          ← Dashboard
        </button>
        <div className="h-4 w-px bg-white/10" />
        <div>
          <h1 className="font-semibold">{entity?.company_name || "Loading..."}</h1>
          <p className="text-xs text-white/40">Stage 2 — Document Ingestion</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Pipeline progress */}
        <div className="glass-card p-4 mb-6 flex items-center gap-3">
          {["Onboarding ✓", "Documents", "Schema", "Analysis", "Report"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`text-sm font-medium ${i === 1 ? "text-blue-400" : i === 0 ? "text-emerald-400" : "text-white/30"}`}>
                {s}
              </span>
              {i < 4 && <span className="text-white/20">→</span>}
            </div>
          ))}
        </div>

        {/* Doc hints */}
        <div className="glass-card p-5 mb-6">
          <h3 className="font-semibold mb-4">Required Document Types</h3>
          <div className="grid grid-cols-5 gap-3">
            {DOC_TYPE_HINTS.map((hint) => (
              <div key={hint.label} className="glass rounded-lg p-3 text-center">
                <div className="text-2xl mb-1">{hint.icon}</div>
                <div className="text-xs font-medium text-white/80">{hint.label}</div>
                <div className="text-xs text-white/40 mt-1">{hint.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Upload area */}
        <div className="glass-card p-6 mb-6">
          <h3 className="font-semibold mb-4">Upload Documents</h3>
          <div
            id="upload-dropzone"
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              dragOver ? "border-blue-500 bg-blue-500/10" : "border-white/15 hover:border-white/30"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <div className="text-4xl mb-3">{uploading ? "⏳" : "📁"}</div>
            <p className="text-white/60 mb-1">{uploading ? "Uploading..." : "Drop files here or click to browse"}</p>
            <p className="text-xs text-white/30">Supports PDF, Excel, JPG, PNG, CSV (up to 50MB each)</p>
            <input
              id="file-input"
              type="file"
              multiple
              accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png,.csv,.txt"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </div>
        </div>

        {/* Documents list */}
        {docs.length > 0 && (
          <div className="glass-card p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Uploaded Documents ({docs.length})</h3>
              {anyPending && (
                <button
                  id="extract-all-btn"
                  onClick={handleExtractAll}
                  disabled={extracting}
                  className="btn-primary text-sm"
                >
                  {extracting ? "⏳ Extracting..." : "⚡ Extract All"}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {docs.map((doc) => {
                const sb = statusBadge(doc.extraction_status);
                return (
                  <div key={doc.id} className="glass rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-lg">
                        {doc.filename.endsWith(".pdf") ? "📄" : doc.filename.match(/\.(xlsx|xls|csv)$/) ? "📊" : "🖼️"}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{doc.filename}</div>
                        <div className="text-xs text-white/40">{formatBytes(doc.file_size || 0)}{doc.page_count ? ` · ${doc.page_count} pages` : ""}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {doc.extraction_status === "extracting" && (
                        <div className="w-4 h-4 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin" />
                      )}
                      <span className={`badge ${sb.cls}`}>{sb.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Proceed button */}
        <div className="flex justify-end">
          <button
            id="classify-proceed-btn"
            onClick={handleClassifyAndProceed}
            disabled={!allExtracted || classifying}
            className="btn-primary"
          >
            {classifying ? "⏳ Classifying with AI..." : "Classify & Proceed to Schema →"}
          </button>
        </div>
      </main>
    </div>
  );
}
