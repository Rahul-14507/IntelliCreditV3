"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createEntity } from "@/lib/api";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const SECTORS = ["Banking", "NBFC", "Manufacturing", "IT/Technology", "Healthcare", "Real Estate", "Retail", "Infrastructure", "Agriculture", "Energy"];
const LOAN_TYPES = ["Term Loan", "Working Capital", "Cash Credit", "Overdraft", "Letter of Credit", "Bank Guarantee"];
const RATINGS = ["AAA", "AA+", "AA", "AA-", "A+", "A", "A-", "BBB+", "BBB", "BB", "B", "Unrated"];

interface FormData {
  company_name: string;
  cin: string;
  pan: string;
  incorporation_year: string;
  registered_address: string;
  website: string;
  credit_rating: string;
  sector: string;
  sub_sector: string;
  annual_turnover_cr: string;
  employee_count: string;
  loan_type: string;
  loan_amount_cr: string;
  loan_tenure_months: string;
  interest_rate_pct: string;
  loan_purpose: string;
  collateral: string;
  field_observations: string;
}

const STEPS = [
  { id: 1, title: "Company Identity", icon: "🏛️" },
  { id: 2, title: "Business Profile", icon: "📊" },
  { id: 3, title: "Loan Request", icon: "💰" },
  { id: 4, title: "Primary Insights", icon: "🎤" },
  { id: 5, title: "Review & Submit", icon: "✅" },
];

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [form, setForm] = useState<FormData>({
    company_name: "",
    cin: "",
    pan: "",
    incorporation_year: "",
    registered_address: "",
    website: "",
    credit_rating: "Unrated",
    sector: "",
    sub_sector: "",
    annual_turnover_cr: "",
    employee_count: "",
    loan_type: "Term Loan",
    loan_amount_cr: "",
    loan_tenure_months: "",
    interest_rate_pct: "",
    loan_purpose: "",
    collateral: "",
    field_observations: "",
  });

  const set = (k: keyof FormData, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const startRecording = () => {
    const SpeechRecognition = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => {
      setIsRecording(false);
      setInterimText("");
    };

    recognition.onresult = (event: any) => {
      let final = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }
      if (final) {
        setForm((f) => ({ ...f, field_observations: f.field_observations + (f.field_observations ? " " : "") + final }));
      }
      setInterimText(interim);
    };

    recognition.start();
    (window as any)._recognition = recognition;
  };

  const stopRecording = () => {
    if ((window as any)._recognition) {
      (window as any)._recognition.stop();
    }
  };

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const payload = {
        company_name: form.company_name,
        cin: form.cin || null,
        pan: form.pan || null,
        incorporation_year: form.incorporation_year ? parseInt(form.incorporation_year) : null,
        registered_address: form.registered_address || null,
        website: form.website || null,
        credit_rating: form.credit_rating || null,
        sector: form.sector || null,
        sub_sector: form.sub_sector || null,
        annual_turnover_cr: form.annual_turnover_cr ? parseFloat(form.annual_turnover_cr) : null,
        employee_count: form.employee_count ? parseInt(form.employee_count) : null,
        loan_type: form.loan_type || null,
        loan_amount_cr: parseFloat(form.loan_amount_cr),
        loan_tenure_months: form.loan_tenure_months ? parseInt(form.loan_tenure_months) : null,
        interest_rate_pct: form.interest_rate_pct ? parseFloat(form.interest_rate_pct) : null,
        loan_purpose: form.loan_purpose || null,
        collateral: form.collateral || null,
        field_observations: form.field_observations || null,
      };
      const entity = await createEntity(payload) as { id: string };
      router.push(`/documents/${entity.id}`);
    } catch {
      alert("Failed to create application. Check backend connection.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="glass border-b border-white/5 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push("/")} className="text-white/40 hover:text-white transition-colors text-sm">
          ← Dashboard
        </button>
        <div className="h-4 w-px bg-white/10" />
        <h1 className="font-semibold">New Credit Application</h1>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-10">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all duration-300 ${
                    step === s.id
                      ? "bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30 scale-110"
                      : step > s.id
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-white/5 text-white/30 border border-white/10"
                  }`}
                >
                  {step > s.id ? "✓" : s.icon}
                </div>
                <span className={`text-xs mt-1 font-medium ${step === s.id ? "text-blue-400" : step > s.id ? "text-emerald-400" : "text-white/30"}`}>
                  {s.title}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px flex-1 mb-5 mx-2 transition-all ${step > s.id ? "bg-emerald-500/40" : "bg-white/10"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="glass-card p-8 animate-slide-in">
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold mb-6">Company Identity</h2>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Company Name <span className="text-red-400">*</span></label>
                <input id="company_name" className="input" value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="e.g. Bajaj Finance Limited" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1.5">CIN</label>
                  <input id="cin" className="input" value={form.cin} onChange={(e) => set("cin", e.target.value)} placeholder="L17110MH1973PLC019786" />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1.5">PAN</label>
                  <input id="pan" className="input" value={form.pan} onChange={(e) => set("pan", e.target.value)} placeholder="AAACR5055K" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1.5">Incorporation Year</label>
                  <input id="incorporation_year" className="input" type="number" value={form.incorporation_year} onChange={(e) => set("incorporation_year", e.target.value)} placeholder="e.g. 2000" />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1.5">Credit Rating</label>
                  <select id="credit_rating" className="input" value={form.credit_rating} onChange={(e) => set("credit_rating", e.target.value)}>
                    {RATINGS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Registered Address</label>
                <textarea className="input" rows={2} value={form.registered_address} onChange={(e) => set("registered_address", e.target.value)} placeholder="Corporate Office address..." />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Website</label>
                <input className="input" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://www.company.com" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold mb-6">Business Profile</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1.5">Sector</label>
                  <select id="sector" className="input" value={form.sector} onChange={(e) => set("sector", e.target.value)}>
                    <option value="">Select sector...</option>
                    {SECTORS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1.5">Sub-Sector</label>
                  <input className="input" value={form.sub_sector} onChange={(e) => set("sub_sector", e.target.value)} placeholder="e.g. Consumer Finance" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1.5">Annual Turnover (₹ Cr)</label>
                  <input id="annual_turnover_cr" className="input" type="number" value={form.annual_turnover_cr} onChange={(e) => set("annual_turnover_cr", e.target.value)} placeholder="e.g. 500" />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1.5">Employee Count</label>
                  <input className="input" type="number" value={form.employee_count} onChange={(e) => set("employee_count", e.target.value)} placeholder="e.g. 2500" />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold mb-6">Loan Request</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1.5">Loan Type</label>
                  <select id="loan_type" className="input" value={form.loan_type} onChange={(e) => set("loan_type", e.target.value)}>
                    {LOAN_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1.5">Loan Amount (₹ Cr) <span className="text-red-400">*</span></label>
                  <input id="loan_amount_cr" className="input" type="number" value={form.loan_amount_cr} onChange={(e) => set("loan_amount_cr", e.target.value)} placeholder="e.g. 50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1.5">Tenure (months)</label>
                  <input id="loan_tenure_months" className="input" type="number" value={form.loan_tenure_months} onChange={(e) => set("loan_tenure_months", e.target.value)} placeholder="e.g. 60" />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1.5">Interest Rate (%)</label>
                  <input className="input" type="number" step="0.1" value={form.interest_rate_pct} onChange={(e) => set("interest_rate_pct", e.target.value)} placeholder="e.g. 10.5" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Loan Purpose</label>
                <textarea className="input" rows={2} value={form.loan_purpose} onChange={(e) => set("loan_purpose", e.target.value)} placeholder="Describe the purpose of the loan..." />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Collateral / Security</label>
                <textarea className="input" rows={2} value={form.collateral} onChange={(e) => set("collateral", e.target.value)} placeholder="Describe collateral being offered..." />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Primary Insights</h2>
                {typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition) && (
                  <div className="flex flex-col items-end">
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ${isRecording ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
                    >
                      <span className="text-xl">{isRecording ? "⏹️" : "🎤"}</span>
                      <span className="text-sm font-medium">{isRecording ? "Recording... (click to stop)" : "Voice Recording"}</span>
                    </button>
                    <span className="text-[10px] text-white/30 mt-1 uppercase tracking-wider">Speak your site visit observations</span>
                  </div>
                )}
              </div>
              <div className="relative">
                <label className="block text-sm text-white/60 mb-2 font-medium">Field Observations & Officer Insights</label>
                <div className="relative">
                  <textarea
                    id="field_observations"
                    className="input min-h-[200px] pt-4 leading-relaxed"
                    value={form.field_observations}
                    onChange={(e) => set("field_observations", e.target.value)}
                    placeholder="Capture real-world insights from site visits, promoter meetings, or local intelligence..."
                  />
                  {interimText && (
                    <div className="absolute top-4 left-4 right-4 pointer-events-none text-white/40 italic">
                      <span className="opacity-0">{form.field_observations}</span>
                      {form.field_observations && " "}
                      {interimText}
                    </div>
                  )}
                </div>
              </div>
              <div className="glass rounded-xl p-4 border border-blue-500/20 bg-blue-500/5">
                <p className="text-xs text-blue-300/80 leading-relaxed italic">
                  💡 <strong>Pro Tip:</strong> These insights are factored directly into the AI's "Governance" and "Risk Assessment" scores, often helping override stale financial data with real-time intelligence.
                </p>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-6">Review & Submit</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  ["Company", form.company_name],
                  ["CIN", form.cin || "—"],
                  ["PAN", form.pan || "—"],
                  ["Sector", form.sector || "—"],
                  ["Sub-Sector", form.sub_sector || "—"],
                  ["Turnover", form.annual_turnover_cr ? `₹${form.annual_turnover_cr} Cr` : "—"],
                  ["Loan Type", form.loan_type],
                  ["Loan Amount", form.loan_amount_cr ? `₹${form.loan_amount_cr} Cr` : "—"],
                  ["Tenure", form.loan_tenure_months ? `${form.loan_tenure_months} months` : "—"],
                  ["Rating", form.credit_rating],
                  ["Insights", form.field_observations ? "Captured ✅" : "None"],
                ].map(([k, v]) => (
                  <div key={k} className="glass rounded-lg p-3">
                    <div className="text-xs text-white/40">{k}</div>
                    <div className="font-medium text-sm mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
              <p className="text-white/50 text-sm mt-4">After submitting, you will be guided to upload financial documents.</p>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t border-white/5">
            <button onClick={() => setStep((s) => s - 1)} className={`btn-secondary ${step === 1 ? "opacity-0 pointer-events-none" : ""}`}>
              ← Back
            </button>
            {step < 5 ? (
              <button
                id="next-step-btn"
                onClick={() => {
                  if (step === 1 && !form.company_name) { alert("Company name is required"); return; }
                  if (step === 3 && !form.loan_amount_cr) { alert("Loan amount is required"); return; }
                  setStep((s) => s + 1);
                }}
                className="btn-primary"
              >
                Next →
              </button>
            ) : (
              <button id="submit-application-btn" onClick={handleSubmit} disabled={submitting} className="btn-primary">
                {submitting ? "Submitting..." : "Submit & Continue →"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
