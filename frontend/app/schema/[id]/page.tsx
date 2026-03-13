"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getEntity, listDocs, confirmDoc, updateSchema, extractSchemas } from "@/lib/api";
import { Entity, Document, SchemaField } from "@/lib/types";

const DOC_TYPE_LABEL: Record<string, string> = {
  ALM: "Asset-Liability Management",
  Shareholding: "Shareholding Pattern",
  Borrowing: "Borrowing Profile",
  AnnualReport: "Annual Report",
  Portfolio: "Portfolio Statement",
};

const DOC_TYPES = ["ALM", "Shareholding", "Borrowing", "AnnualReport", "Portfolio"];

export default function SchemaPage() {
  const router = useRouter();
  const params = useParams();
  const entityId = params.id as string;

  const [entity, setEntity] = useState<Entity | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [tab, setTab] = useState<"classify" | "schema" | "extract">("classify");
  const [extracting, setExtracting] = useState(false);

  const loadDocs = useCallback(async () => {
    const d = await listDocs(entityId) as Document[];
    setDocs(d);
  }, [entityId]);

  useEffect(() => {
    getEntity(entityId).then((e) => setEntity(e as Entity));
    loadDocs();
  }, [entityId, loadDocs]);

  async function handleConfirm(docId: string, confirmedType: string, action: "approve" | "reject" | "edit") {
    await confirmDoc(entityId, docId, { confirmed_type: confirmedType, action });
    loadDocs();
  }

  async function handleSchemaUpdate(docId: string, fields: SchemaField[]) {
    await updateSchema(entityId, docId, fields);
    loadDocs();
  }

  async function handleExtractAll() {
    setExtracting(true);
    try {
      await extractSchemas(entityId);
      await loadDocs();
      setTab("extract");
    } catch {
      alert("Extraction failed — make sure all documents are confirmed.");
    } finally {
      setExtracting(false);
    }
  }

  const classifiedDocs = docs.filter((d) => d.classification_status !== "pending");
  const confirmedDocs = docs.filter((d) => d.classification_status === "confirmed");
  const extractedDocs = docs.filter((d) => d.schema_status === "done");

  const confidenceColor = (c: number | null) => {
    if (!c) return "text-white/40";
    if (c >= 0.85) return "text-emerald-400";
    if (c >= 0.65) return "text-amber-400";
    return "text-red-400";
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
          <p className="text-xs text-white/40">Stage 3 — Schema Mapping & Extraction</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Pipeline progress */}
        <div className="glass-card p-4 mb-6 flex items-center gap-3">
          {["Onboarding ✓", "Documents ✓", "Schema", "Analysis", "Report"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`text-sm font-medium ${i === 2 ? "text-blue-400" : i < 2 ? "text-emerald-400" : "text-white/30"}`}>{s}</span>
              {i < 4 && <span className="text-white/20">→</span>}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 glass rounded-xl p-1 w-fit">
          {([
            { key: "classify", label: `Classification Review (${classifiedDocs.length})` },
            { key: "schema", label: `Schema Editor (${confirmedDocs.length})` },
            { key: "extract", label: `Extraction Preview (${extractedDocs.length})` },
          ] as const).map((t) => (
            <button
              key={t.key}
              id={`tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key
                  ? "bg-gradient-to-r from-blue-500/30 to-purple-500/20 text-white border border-blue-500/40"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Classification Review */}
        {tab === "classify" && (
          <div className="space-y-4 animate-slide-in">
            {docs.length === 0 ? (
              <div className="glass-card p-10 text-center text-white/50">
                No documents found. Go back to upload documents first.
              </div>
            ) : (
              docs.map((doc) => (
                <div key={doc.id} className="glass-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📄</span>
                      <div>
                        <div className="font-medium">{doc.filename}</div>
                        <div className="text-xs text-white/40">
                          {doc.classification_status === "pending" ? "Not yet classified" :
                           doc.classification_status === "confirmed" ? `✅ Confirmed as ${DOC_TYPE_LABEL[doc.confirmed_doc_type || ""] || doc.confirmed_doc_type}` :
                           doc.classification_status === "rejected" ? "❌ Rejected" :
                           `🤖 Predicted: ${DOC_TYPE_LABEL[doc.predicted_doc_type || ""] || doc.predicted_doc_type}`}
                        </div>
                      </div>
                    </div>
                    {doc.predicted_confidence != null && (
                      <div className="text-right">
                        <div className={`text-lg font-bold ${confidenceColor(doc.predicted_confidence)}`}>
                          {Math.round(doc.predicted_confidence * 100)}%
                        </div>
                        <div className="text-xs text-white/40">confidence</div>
                      </div>
                    )}
                  </div>

                  {doc.predicted_reasoning && (
                    <p className="text-sm text-white/60 mb-3 glass rounded-lg p-3 italic">
                      &ldquo;{doc.predicted_reasoning}&rdquo;
                    </p>
                  )}

                  {doc.predicted_signals && doc.predicted_signals.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {doc.predicted_signals.map((sig) => (
                        <span key={sig} className="badge badge-blue text-xs">{sig}</span>
                      ))}
                    </div>
                  )}

                  {doc.classification_status !== "confirmed" && doc.classification_status !== "rejected" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-white/50 mr-1">Override type:</span>
                      {DOC_TYPES.map((t) => (
                        <button
                          key={t}
                          onClick={() => handleConfirm(doc.id, t, t === doc.predicted_doc_type ? "approve" : "edit")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            t === doc.predicted_doc_type
                              ? "border-blue-500/50 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
                              : "border-white/10 text-white/50 hover:border-white/30 hover:text-white"
                          }`}
                        >
                          {t === doc.predicted_doc_type ? "✓ " : ""}{t}
                        </button>
                      ))}
                      <button
                        onClick={() => handleConfirm(doc.id, doc.predicted_doc_type || "", "reject")}
                        className="btn-danger text-xs"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {doc.classification_status === "confirmed" && (
                    <div className="flex gap-2 items-center">
                      <span className="badge badge-approve">Confirmed</span>
                      <button
                        onClick={() => handleConfirm(doc.id, doc.confirmed_doc_type || "", "edit")}
                        className="text-xs text-white/40 hover:text-white underline"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            {classifiedDocs.length > 0 && (
              <div className="flex justify-end">
                <button onClick={() => setTab("schema")} className="btn-primary">
                  Edit Schemas →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab: Schema Editor */}
        {tab === "schema" && (
          <div className="space-y-4 animate-slide-in">
            {confirmedDocs.length === 0 ? (
              <div className="glass-card p-10 text-center text-white/50">
                No confirmed documents. Confirm at least one document in the Classification Review tab.
              </div>
            ) : (
              confirmedDocs.map((doc) => (
                <SchemaEditor key={doc.id} doc={doc} onSave={(fields) => handleSchemaUpdate(doc.id, fields)} />
              ))
            )}
            {confirmedDocs.length > 0 && (
              <div className="flex justify-end gap-3">
                <button
                  id="extract-structured-btn"
                  onClick={handleExtractAll}
                  disabled={extracting}
                  className="btn-primary"
                >
                  {extracting ? "⏳ Extracting..." : "Run Structured Extraction →"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab: Extraction Preview */}
        {tab === "extract" && (
          <div className="space-y-6 animate-slide-in">
            {extractedDocs.length === 0 ? (
              <div className="glass-card p-10 text-center text-white/50">
                No extracted data yet. Run Structured Extraction from the Schema Editor tab.
              </div>
            ) : (
              <>
                {extractedDocs.map((doc) => (
                  <div key={doc.id} className="glass-card p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <span className="badge badge-purple mr-2">{doc.confirmed_doc_type}</span>
                        <span className="font-medium">{doc.filename}</span>
                      </div>
                      {doc.extraction_confidence != null && (
                        <div className={`text-sm font-bold ${confidenceColor(doc.extraction_confidence)}`}>
                          Confidence: {Math.round(doc.extraction_confidence * 100)}%
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {doc.extracted_data && Object.entries(doc.extracted_data)
                        .filter(([k]) => !k.startsWith("_"))
                        .map(([k, v]) => (
                          <div key={k} className="glass rounded-lg p-3">
                            <div className="text-xs text-white/40 mb-0.5">{k.replace(/_/g, " ")}</div>
                            <div className="text-sm font-medium">
                              {v === null ? <span className="text-white/30 italic">Not found</span> :
                               Array.isArray(v) ? <span className="text-blue-400">[Table: {v.length} rows]</span> :
                               String(v)}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end">
                  <button
                    id="proceed-to-analysis-btn"
                    onClick={() => router.push(`/report/${entityId}`)}
                    className="btn-primary"
                  >
                    Proceed to Analysis & Report →
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function SchemaEditor({ doc, onSave }: { doc: Document; onSave: (fields: SchemaField[]) => void }) {
  const [fields, setFields] = useState<SchemaField[]>(doc.schema_fields || []);
  const [saved, setSaved] = useState(false);

  const toggle = (i: number) => setFields((f) => f.map((field, idx) => idx === i ? { ...field, include: !field.include } : field));

  const addField = () => setFields((f) => [...f, { key: `custom_${Date.now()}`, label: "Custom Field", type: "text", include: true }]);

  const remove = (i: number) => setFields((f) => f.filter((_, idx) => idx !== i));

  const handleSave = () => { onSave(fields); setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="badge badge-purple mr-2">{doc.confirmed_doc_type}</span>
          <span className="font-medium text-sm">{doc.filename}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={addField} className="btn-secondary text-xs">+ Add Field</button>
          <button onClick={handleSave} className={`btn-primary text-xs ${saved ? "from-emerald-500 to-emerald-600" : ""}`}>
            {saved ? "✓ Saved!" : "Save Schema"}
          </button>
        </div>
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {fields.map((field, i) => (
          <div key={i} className={`flex items-center gap-3 glass rounded-lg p-3 transition-opacity ${field.include ? "" : "opacity-50"}`}>
            <button onClick={() => toggle(i)} className={`w-5 h-5 rounded flex items-center justify-center border flex-shrink-0 ${field.include ? "border-blue-500 bg-blue-500" : "border-white/20"}`}>
              {field.include && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12"><polyline points="1,6 4,9 11,2" stroke="currentColor" strokeWidth="2" fill="none"/></svg>}
            </button>
            <input
              className="input py-1 px-2 text-sm flex-1"
              value={field.label}
              onChange={(e) => setFields((f) => f.map((fd, idx) => idx === i ? { ...fd, label: e.target.value } : fd))}
            />
            <span className="text-xs text-white/40 flex-shrink-0">{field.type}</span>
            <button onClick={() => remove(i)} className="text-white/30 hover:text-red-400 transition-colors text-sm flex-shrink-0">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
