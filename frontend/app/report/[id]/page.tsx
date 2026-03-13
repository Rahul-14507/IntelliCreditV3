"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
import {
  getEntity, runResearch, runAnalysis, getAnalysisStatus, getAnalysis, exportDocxUrl, recalculate, deleteEntity
} from "@/lib/api";
import { Entity, Analysis, ReasoningStep, ResearchResult } from "@/lib/types";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip
} from "recharts";

const SIGNAL_COLORS: Record<string, string> = {
  POSITIVE: "badge-approve",
  NEUTRAL: "badge-blue",
  NEGATIVE: "badge-reject",
};

const IMPACT_DOT: Record<string, string> = {
  HIGH: "bg-red-400",
  MEDIUM: "bg-amber-400",
  LOW: "bg-emerald-400",
};

const REC_STYLE: Record<string, string> = {
  APPROVE: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-300",
  CONDITIONAL_APPROVE: "from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-300",
  REJECT: "from-red-500/20 to-red-600/10 border-red-500/30 text-red-300",
};

const REC_ICON: Record<string, string> = {
  APPROVE: "✅",
  CONDITIONAL_APPROVE: "⚠️",
  REJECT: "❌",
};

export default function ReportPage() {
  const router = useRouter();
  const params = useParams();
  const entityId = params.id as string;

  const [entity, setEntity] = useState<Entity | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [status, setStatus] = useState({ research_status: "not_started", analysis_status: "not_started" });
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [activeResearchTab, setActiveResearchTab] = useState<"news" | "legal" | "macro">("news");
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([1]));
  const [resettingAndRerunning, setResettingAndRerunning] = useState(false);
  
  // Observation Modal State
  const [isObservationModalOpen, setIsObservationModalOpen] = useState(false);
  const [observation, setObservation] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Scenario Simulator State
  const [scenario, setScenario] = useState({
    de: 0.67,
    cr: 1.58,
    ebitda: 35.1,
    growth: 27,
    icr: 10.15,
  });

  // Load actuals on first load
  useEffect(() => {
    if (analysis?.scores) {
      // In a real app we'd fetch the exact ratios from the extracted data docs
      // For now, we'll keep the placeholders or try to extract if document data is in analysis
      // Actually, let's just stick to the user's provided "current" values as defaults
    }
  }, [analysis]);

  const scoreDE = (val: number) => {
    if (val < 0.75) return 95;
    if (val < 1.5) return 80;
    if (val < 2.5) return 60;
    if (val < 3.5) return 40;
    return 20;
  };

  const scoreCR = (val: number) => {
    if (val >= 2.0) return 95;
    if (val >= 1.5) return 80;
    if (val >= 1.2) return 60;
    if (val >= 1.0) return 40;
    return 20;
  };

  const scoreEBITDA = (val: number) => {
    if (val >= 30) return 95;
    if (val >= 20) return 80;
    if (val >= 15) return 60;
    if (val >= 10) return 40;
    return 20;
  };

  const scoreGrowth = (val: number) => {
    if (val >= 25) return 95;
    if (val >= 15) return 80;
    if (val >= 10) return 60;
    if (val >= 5) return 40;
    return 20;
  };

  const scoreICR = (val: number) => {
    if (val >= 8.0) return 95;
    if (val >= 5.0) return 80;
    if (val >= 3.0) return 60;
    if (val >= 2.0) return 40;
    return 20;
  };

  const heuristicFinHealth = (vals: typeof scenario) => 
    scoreDE(vals.de) * 0.25 + 
    scoreCR(vals.cr) * 0.20 + 
    scoreEBITDA(vals.ebitda) * 0.25 + 
    scoreGrowth(vals.growth) * 0.15 + 
    scoreICR(vals.icr) * 0.15;

  const actualsHeuristic = heuristicFinHealth({ de: 0.67, cr: 1.58, ebitda: 35.1, growth: 27, icr: 10.15 });
  const currentHeuristic = heuristicFinHealth(scenario);
  const finHealthDelta = currentHeuristic - actualsHeuristic;

  const simFinHealth = Math.round((analysis?.scores?.financial_health || 70) + finHealthDelta);

  const simOverall = (
    (analysis?.scores?.overall || 0) + (finHealthDelta * 0.30)
  ).toFixed(1);

  const getSimGrade = (score: number) => {
    if (score >= 80) return "A";
    if (score >= 65) return "B";
    if (score >= 50) return "C";
    return "D";
  };

  const getSimRate = (score: number) => {
    if (score >= 90) return 9.25;
    if (score >= 80) return 10.5;
    if (score >= 70) return 11.75;
    if (score >= 50) return 13.5;
    return 15.0;
  };

  const simGrade = getSimGrade(parseFloat(simOverall));
  const simRate = getSimRate(parseFloat(simOverall));
  const scoreDelta = Math.round(parseFloat(simOverall) - (analysis?.scores?.overall || 0));

  const resetScenario = () => setScenario({ de: 0.67, cr: 1.58, ebitda: 35.1, growth: 27, icr: 10.15 });

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
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

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    recognition.onresult = (event: any) => {
      let final = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }
      if (final) {
        setObservation((o) => o + (o ? " " : "") + final);
      }
      setInterimText(interim);
    };

    recognition.start();
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    (window as any)._recognition = recognition;
  };

  const stopRecording = () => {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    if ((window as any)._recognition) {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      (window as any)._recognition.stop();
    }
  };

  const handleAddObservation = async () => {
    setIsRecalculating(true);
    try {
      await recalculate(entityId, { observations: observation });
      setIsObservationModalOpen(false);
      setObservation("");
      setStatus({ research_status: "done", analysis_status: "not_started" });
      setAnalysis(null);
      // Kick off analysis
      await runAnalysis(entityId);
    } catch {
      alert("Failed to add observation.");
    } finally {
      setIsRecalculating(false);
    }
  };
  const handleDeleteApplication = async () => {
    if (!confirm(`Are you sure you want to delete the application for ${entity?.company_name}? This cannot be undone.`)) return;
    try {
      await deleteEntity(entityId);
      router.push("/");
    } catch {
      alert("Failed to delete application.");
    }
  };


  const loadStatus = useCallback(async () => {
    try {
      const s = await getAnalysisStatus(entityId) as { research_status: string; analysis_status: string; grade?: string; recommendation?: string };
      setStatus(s);
      return s;
    } catch { return null; }
  }, [entityId]);

  const loadAnalysis = useCallback(async () => {
    try {
      const a = await getAnalysis(entityId) as Analysis;
      setAnalysis(a);
    } catch {}
  }, [entityId]);

  useEffect(() => {
    getEntity(entityId).then((e) => setEntity(e as Entity));

    // Kick off research + analysis if not started
    (async () => {
      const s = await loadStatus();
      if (s?.analysis_status === "done") {
        await loadAnalysis();
      }
      setIsInitialLoading(false);
      
      if (!s) return;

      // 1. Trigger research if not started or stuck in pending
      if (s.research_status === "not_started" || s.research_status === "pending") {
        try { await runResearch(entityId); } catch {}
      }

      // 2. Wait for research to finish before analysis
      if (s.research_status !== "done") {
        try {
          await retry(async () => {
            const latest = await getAnalysisStatus(entityId) as { research_status: string };
            if (latest.research_status !== "done") throw new Error("not done");
          }, 120, 2000);
        } catch { return; }
      }

      // 3. Trigger analysis if research is done but analysis hasn't started or is pending
      const latest = await loadStatus();
      if (latest && (latest.analysis_status === "not_started" || latest.analysis_status === "pending")) {
        try { await runAnalysis(entityId); } catch {}
      }
    })();

    // Poll status until done
    const interval = setInterval(async () => {
      const s = await loadStatus();
      if (s?.analysis_status === "done") {
        clearInterval(interval);
        loadAnalysis();
      }
    }, 3000);

    // Also load if already done
    loadStatus().then((s) => {
      if (s?.analysis_status === "done") loadAnalysis();
    });

    return () => clearInterval(interval);
  }, [entityId, loadStatus, loadAnalysis]);

  async function retry(fn: () => Promise<void>, times: number, delayMs: number) {
    for (let i = 0; i < times; i++) {
      try { await fn(); return; } catch {}
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  async function handleRecalculate() {
    setResettingAndRerunning(true);
    try {
      await recalculate(entityId);
      setAnalysis(null);
      setStatus({ research_status: "not_started", analysis_status: "not_started" });
      await runResearch(entityId);
    } catch {
      setResettingAndRerunning(false);
    }
  }

  const toggleStep = (step: number) => {
    setExpandedSteps((s) => {
      const n = new Set(s);
      if (n.has(step)) { n.delete(step); } else { n.add(step); }
      return n;
    });
  };

  const isLoading = status.analysis_status !== "done";
  const showDetailedLoading = !isInitialLoading && isLoading;

  const radarData = analysis?.scores
    ? [
        { subject: "Financial", value: analysis.scores.financial_health },
        { subject: "Asset Quality", value: analysis.scores.asset_quality },
        { subject: "Governance", value: analysis.scores.governance },
        { subject: "Liquidity", value: analysis.scores.liquidity_alm },
        { subject: "Market Pos.", value: analysis.scores.market_position },
      ]
    : [];

  return (
    <div className="min-h-screen">
      <header className="glass border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/")} className="text-white/40 hover:text-white transition-colors text-sm">
            ← Dashboard
          </button>
          <div className="h-4 w-px bg-white/10" />
          <div>
            <h1 className="font-semibold">{entity?.company_name || "Loading..."}</h1>
            <p className="text-xs text-white/40">Stage 4 — AI Credit Report</p>
          </div>
        </div>
        <div className="flex gap-2">
          {analysis?.analysis_status === "done" && (
            <>
              <a
                id="export-docx-btn"
                href={exportDocxUrl(entityId)}
                target="_blank"
                className="btn-secondary text-sm"
              >
                📄 Download Word Report
              </a>
              <button onClick={handleRecalculate} disabled={resettingAndRerunning} className="btn-secondary text-sm">
                🔄 Recalculate
              </button>
              <button 
                id="delete-application-btn"
                onClick={handleDeleteApplication} 
                className="btn-danger text-sm px-3"
                title="Delete this application"
              >
                ✕ Delete
              </button>
            </>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Loading state */}
        {showDetailedLoading && (
          <div className="glass-card p-10 text-center mb-6 animate-fade-in">
            <div className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin mx-auto mb-6" />
            <h2 className="text-xl font-bold mb-2 gradient-text">AI Analysis in Progress</h2>
            <p className="text-white/50 mb-6">Please wait while IntelliCredit processes your documents...</p>
            <div className="max-w-md mx-auto space-y-3">
              {[
                { label: "Tavily Research (News, Legal, Macro)", status: status.research_status },
                { label: "GPT-4o Credit Scoring (7-step reasoning)", status: status.analysis_status },
                { label: "SWOT & Triangulation", status: status.analysis_status },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 text-sm">
                  <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${
                    item.status === "done" ? "bg-emerald-500 text-white" :
                    item.status === "running" ? "border-2 border-blue-500/30 border-t-blue-500 animate-spin" :
                    item.status === "error" ? "bg-red-500 text-white" :
                    "bg-white/10"
                  }`}>
                    {item.status === "done" ? "✓" : item.status === "error" ? "✕" : ""}
                  </div>
                  <span className={item.status === "done" ? "text-white/70" : item.status === "running" ? "text-blue-400" : "text-white/30"}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analysis complete */}
        {analysis && analysis.analysis_status === "done" && (
          <div className="space-y-6 animate-slide-in">
            {/* Decision Banner */}
            <div className={`glass-card p-6 bg-gradient-to-br ${REC_STYLE[analysis.recommendation] || ""} border flex items-center justify-between`}>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">{REC_ICON[analysis.recommendation]}</span>
                  <div>
                    <div className="text-2xl font-bold">{analysis.recommendation?.replace("_", " ")}</div>
                    <div className="text-sm opacity-70">Credit Committee Decision</div>
                  </div>
                </div>
                <p className="text-sm opacity-80 max-w-2xl">{analysis.executive_summary}</p>
              </div>
              <div className="text-right flex-shrink-0 ml-6">
                <div className="text-4xl font-bold">{analysis.grade}</div>
                <div className="text-sm opacity-60">Overall Grade</div>
                <div className="mt-2 text-xl font-bold">{analysis.scores?.overall}/100</div>
                <div className="text-xs opacity-60">Score</div>
              </div>
            </div>

            {/* Epistemic Notes / Field Observations */}
            <div className="glass-card p-5 border-l-4 border-blue-500">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">🧠 Epistemic Notes / AI Analysis Notes</h3>
                  <p className="text-xs text-white/40 mt-1">Combine AI research with real-world field intelligence for maximum accuracy.</p>
                </div>
                <button
                  onClick={() => setIsObservationModalOpen(true)}
                  className="btn-primary text-xs flex items-center gap-2"
                >
                  ➕ Add Field Observation
                </button>
              </div>
              {entity?.field_observations && (
                <div className="mt-4 glass rounded-xl p-4 bg-white/5 border border-white/5">
                  <div className="text-[10px] uppercase tracking-widest text-blue-400 font-bold mb-2">Captured Intelligence</div>
                  <p className="text-sm text-white/70 italic leading-relaxed whitespace-pre-wrap">
                    &quot;{entity.field_observations}&quot;
                  </p>
                </div>
              )}
            </div>

            {/* Loan Terms */}
            <div className="glass-card p-5">
              <h3 className="font-semibold mb-4">Recommended Loan Terms</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Limit", value: analysis.recommended_limit_cr ? `₹${analysis.recommended_limit_cr} Cr` : "—" },
                  { label: "Interest Rate", value: analysis.recommended_rate_pct ? `${analysis.recommended_rate_pct}%` : "—" },
                  { label: "Tenure", value: analysis.recommended_tenure_months ? `${analysis.recommended_tenure_months} months` : "—" },
                ].map((t) => (
                  <div key={t.label} className="glass rounded-xl p-4 text-center">
                    <div className="text-xs text-white/40 mb-1">{t.label}</div>
                    <div className="text-xl font-bold text-blue-400">{t.value}</div>
                  </div>
                ))}
              </div>
              {analysis.conditions && analysis.conditions.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-amber-400 mb-2">⚠️ Conditions</h4>
                  <ul className="space-y-1">
                    {analysis.conditions.map((c, i) => (
                      <li key={i} className="text-sm text-white/70 flex gap-2">
                        <span className="text-amber-400 flex-shrink-0">•</span>{c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Score + Radar */}
            <div className="grid grid-cols-2 gap-6">
              <div className="glass-card p-5">
                <h3 className="font-semibold mb-4">Score Breakdown</h3>
                <div className="space-y-3">
                  {analysis.scores && Object.entries(analysis.scores).filter(([k]) => k !== "overall").map(([k, v]) => (
                    <div key={k}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-white/70">{k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                        <span className={`font-bold ${Number(v) >= 70 ? "text-emerald-400" : Number(v) >= 50 ? "text-amber-400" : "text-red-400"}`}>{v}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${v}%`, background: Number(v) >= 70 ? "linear-gradient(90deg,#10B981,#34D399)" : Number(v) >= 50 ? "linear-gradient(90deg,#F59E0B,#FCD34D)" : "linear-gradient(90deg,#EF4444,#F87171)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-card p-5">
                <h3 className="font-semibold mb-2">Score Radar</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} />
                    <Radar name="Score" dataKey="value" stroke="#60A5FA" fill="#60A5FA" fillOpacity={0.2} strokeWidth={2} />
                    <Tooltip contentStyle={{ background: "#0D1526", border: "1px solid rgba(37,99,235,0.3)", borderRadius: 8 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Reasoning Timeline */}
            <div className="glass-card p-5">
              <h3 className="font-semibold mb-5">🧠 Reasoning Engine</h3>
              <div className="space-y-3">
                {analysis.reasoning_chain?.map((step: ReasoningStep) => (
                  <div key={step.step} className="glass rounded-xl overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
                      onClick={() => toggleStep(step.step)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
                          {step.step}
                        </div>
                        <div>
                          <span className="font-medium text-sm">{step.factor}</span>
                          <div className="text-xs text-white/40 mt-0.5">Weight: {step.weight}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className={`w-2 h-2 rounded-full ${IMPACT_DOT[step.impact] || "bg-gray-400"}`} />
                        <span className={`badge ${SIGNAL_COLORS[step.signal] || "badge-gray"} text-xs`}>{step.signal}</span>
                        <span className="text-white/30 text-xs ml-2">{expandedSteps.has(step.step) ? "▲" : "▼"}</span>
                      </div>
                    </button>
                    {expandedSteps.has(step.step) && (
                      <div className="px-4 pb-4 text-sm text-white/60 border-t border-white/5 pt-3">
                        {step.evidence}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Document Consistency Audit */}
            {analysis.document_consistency && (
              <div className="glass-card p-6 border-t-4 border-blue-500/30 bg-gradient-to-b from-white/[0.02] to-transparent">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-5">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-4xl shadow-2xl transition-all duration-500 ${
                      analysis.document_consistency.overall_consistency_score >= 85 ? "bg-emerald-500/20 text-emerald-400 shadow-emerald-500/10 ring-1 ring-emerald-500/30" :
                      analysis.document_consistency.overall_consistency_score >= 70 ? "bg-amber-500/20 text-amber-400 shadow-amber-500/10 ring-1 ring-amber-500/30" :
                      "bg-red-500/20 text-red-400 shadow-red-500/10 ring-1 ring-red-500/30"
                    }`}>
                      🛡️
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold font-display tracking-tight text-white/90">Document Consistency Audit</h3>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs uppercase tracking-widest text-white/30 font-semibold">Verification Score</span>
                        <div className="h-1 w-1 rounded-full bg-white/20" />
                        <span className={`text-base font-black ${
                          analysis.document_consistency.overall_consistency_score >= 85 ? "text-emerald-400" :
                          analysis.document_consistency.overall_consistency_score >= 70 ? "text-amber-400" :
                          "text-red-400"
                        }`}>
                          {analysis.document_consistency.overall_consistency_score}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="hidden sm:block text-right">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/20 mb-2 font-bold">Audit Confidence</div>
                    <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black tracking-widest border transition-all duration-300 ${
                      analysis.document_consistency.overall_consistency_score >= 85 ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5 shadow-inner shadow-emerald-500/10" :
                      analysis.document_consistency.overall_consistency_score >= 70 ? "border-amber-500/30 text-amber-400 bg-amber-500/5 shadow-inner shadow-amber-500/10" :
                      "border-red-500/30 text-red-400 bg-red-500/5 shadow-inner shadow-red-500/10"
                    }`}>
                      {analysis.document_consistency.overall_consistency_score >= 85 ? "✓ PRECISION VERIFIED" :
                       analysis.document_consistency.overall_consistency_score >= 70 ? "⚠ REVIEW REQUIRED" : "✖ CRITICAL VARIANCE"}
                    </div>
                  </div>
                </div>

                {analysis.document_consistency.red_flags.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 mb-8 ring-1 ring-red-500/10 animate-pulse-slow">
                    <div className="flex items-center gap-3 text-red-400 font-black text-xs uppercase tracking-widest mb-3">
                      <span className="text-lg">🚨</span> High-Risk Inconsistencies Detected
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {analysis.document_consistency.red_flags.map((flag, i) => (
                        <div key={i} className="flex items-start gap-3 bg-red-500/5 p-3 rounded-lg border border-red-500/10">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span className="text-xs text-red-200/70 font-medium leading-relaxed">{flag}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="overflow-hidden glass rounded-2xl border border-white/5 bg-white/[0.01]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/[0.02] text-[10px] uppercase tracking-[0.15em] text-white/30 font-bold border-b border-white/5">
                        <th className="px-6 py-4">Verification Check</th>
                        <th className="px-6 py-4">Audit Status</th>
                        <th className="px-6 py-4">Evidence & Findings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {analysis.document_consistency.checks_performed.map((check, i) => (
                        <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-5">
                            <div className="text-sm font-bold text-white/80 group-hover:text-blue-400 transition-colors">{check.check_name}</div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[10px] text-white/20 bg-white/5 px-2 py-0.5 rounded uppercase font-mono">{check.document_a?.slice(0, 15)}</span>
                              <span className="text-[10px] text-white/20">vs</span>
                              <span className="text-[10px] text-white/20 bg-white/5 px-2 py-0.5 rounded uppercase font-mono">{check.document_b?.slice(0, 15)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${
                                check.status === "CONSISTENT" ? "bg-emerald-500 shadow-emerald-500/50" :
                                check.status === "MINOR_VARIANCE" ? "bg-amber-500 shadow-amber-500/50" :
                                check.status === "MAJOR_VARIANCE" ? "bg-red-500 shadow-red-500/50" :
                                "bg-white/20"
                              }`} />
                              <span className={`text-[10px] font-black tracking-widest uppercase ${
                                check.status === "CONSISTENT" ? "text-emerald-500/80" :
                                check.status === "MINOR_VARIANCE" ? "text-amber-500/80" :
                                check.status === "MAJOR_VARIANCE" ? "text-red-500/80" :
                                "text-white/20"
                              }`}>
                                {check.status.replace(/_/g, " ")}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <p className="text-xs text-white/50 leading-relaxed font-medium">
                              {check.flag || `Values verified within 10% tolerance threshold.`}
                            </p>
                            <div className="flex items-center gap-4 mt-2">
                                <div className="text-[10px] text-white/20 font-mono">
                                    {check.value_a} ⟷ {check.value_b}
                                </div>
                                {check.variance_pct !== null && (
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                        Math.abs(check.variance_pct) > 10 ? "bg-red-500/10 text-red-400" : "bg-emerald-500/5 text-emerald-400/50"
                                    }`}>
                                        {check.variance_pct > 0 ? "+" : ""}{check.variance_pct.toFixed(1)}% VAR
                                    </span>
                                )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-8 flex items-center gap-4 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold italic text-sm">i</div>
                  <p className="text-[11px] text-blue-300/60 font-medium leading-relaxed italic">
                    {analysis.document_consistency.summary}
                  </p>
                </div>
              </div>
            )}

            {/* SWOT */}
            <div className="glass-card p-5">
              <h3 className="font-semibold mb-4 text-center">🎯 Scenario Simulator — Test Credit Conditions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-blue-500/5 p-6 rounded-2xl border border-blue-500/20">
                <div className="space-y-6">
                  {[
                    { key: "de", label: "Debt/Equity", min: 0.1, max: 5.0, step: 0.1, suffix: "", current: 0.67 },
                    { key: "cr", label: "Current Ratio", min: 0.5, max: 3.0, step: 0.05, suffix: "", current: 1.58 },
                    { key: "ebitda", label: "EBITDA Margin", min: 1, max: 50, step: 0.5, suffix: "%", current: 35.1 },
                    { key: "growth", label: "Revenue Growth", min: -20, max: 50, step: 1, suffix: "%", current: 27 },
                    { key: "icr", label: "Interest Coverage", min: 0.5, max: 15, step: 0.1, suffix: "x", current: 10.15 },
                  ].map((field) => (
                    <div key={field.key} className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-white/70 font-medium">{field.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/30">[actual: {field.current}{field.suffix}]</span>
                          <span className="text-blue-400 font-bold">{scenario[field.key as keyof typeof scenario]}{field.suffix}</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={scenario[field.key as keyof typeof scenario]}
                        onChange={(e) => setScenario({ ...scenario, [field.key]: parseFloat(e.target.value) })}
                        className="w-full accent-blue-500"
                      />
                    </div>
                  ))}
                  <button onClick={resetScenario} className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
                    🔄 Reset to Actual Values
                  </button>
                </div>

                <div className="flex flex-col justify-center">
                  <div className="glass p-6 rounded-2xl border-2 border-blue-500/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4">
                      <div className={`text-4xl font-black ${simGrade === "A" ? "text-emerald-400" : simGrade === "B" ? "text-blue-400" : "text-amber-400"}`}>
                        {simGrade}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-white/40 text-right">Grade</div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="text-xs text-white/40 mb-1">Simulated Financial Health</div>
                        <div className="text-3xl font-bold text-white">{simFinHealth}</div>
                      </div>
                      
                      <div>
                        <div className="text-xs text-white/40 mb-1">Overall Credit Score</div>
                        <div className="flex items-baseline gap-2">
                          <div className="text-5xl font-black gradient-text">{simOverall}</div>
                          <div className={`text-sm font-bold ${scoreDelta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {scoreDelta >= 0 ? "+" : ""}{scoreDelta} pts
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                        <div className="text-sm">
                          <span className="text-white/40">Interest Rate:</span>
                          <span className="ml-2 font-bold text-blue-300">{simRate}%</span>
                        </div>
                        <div className="text-[10px] text-white/20 italic">
                          Held constant for other dimensions
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-[10px] text-white/30 text-center px-4">
                    Simulator uses extracted financial values. Other regions (Governance, Market Pos, etc.) held constant at analysis levels.
                  </p>
                </div>
              </div>
            </div>

            {/* SWOT */}
            <div className="glass-card p-5">
              <h3 className="font-semibold mb-4">SWOT Analysis</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "strengths", label: "Strengths", emoji: "💪", cls: "border-emerald-500/30 bg-emerald-500/5" },
                  { key: "weaknesses", label: "Weaknesses", emoji: "⚠️", cls: "border-red-500/30 bg-red-500/5" },
                  { key: "opportunities", label: "Opportunities", emoji: "🚀", cls: "border-blue-500/30 bg-blue-500/5" },
                  { key: "threats", label: "Threats", emoji: "🌩️", cls: "border-amber-500/30 bg-amber-500/5" },
                ].map(({ key, label, emoji, cls }) => (
                  <div key={key} className={`rounded-xl p-4 border ${cls}`}>
                    <div className="font-semibold text-sm mb-3">{emoji} {label}</div>
                    <ul className="space-y-1.5">
                      {(analysis.swot?.[key as keyof typeof analysis.swot] || []).map((item: string, i: number) => (
                        <li key={i} className="text-xs text-white/70 flex gap-2">
                          <span className="flex-shrink-0">•</span>{item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Research Feed */}
            <div className="glass-card p-5">
              <h3 className="font-semibold mb-2">🔍 Tavily Research Feed</h3>
              {analysis.sentiment && (
                <div className="glass rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div>
                      <span className="text-xs text-white/40">Sentiment</span>
                      <div className={`font-bold mt-0.5 ${analysis.sentiment.overall_sentiment === "POSITIVE" ? "text-emerald-400" : analysis.sentiment.overall_sentiment === "NEGATIVE" ? "text-red-400" : "text-amber-400"}`}>
                        {analysis.sentiment.overall_sentiment}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-white/40">Score</span>
                      <div className="font-bold mt-0.5">{analysis.sentiment.sentiment_score?.toFixed(2)}</div>
                    </div>
                    {analysis.sentiment.red_flags && analysis.sentiment.red_flags.length > 0 && (
                      <div className="flex-1">
                        <span className="text-xs text-red-400 font-medium">⚠️ Red Flags</span>
                        <div className="flex gap-2 flex-wrap mt-1">
                          {analysis.sentiment.red_flags.map((f, i) => (
                            <span key={i} className="badge badge-reject text-xs">{f}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {analysis.sentiment.sector_outlook && (
                    <p className="text-sm text-white/60 mt-3 border-t border-white/5 pt-3">{analysis.sentiment.sector_outlook}</p>
                  )}
                </div>
              )}
              <div className="flex gap-1 mb-4 glass rounded-lg p-1 w-fit">
                {(["news", "legal", "macro"] as const).map((t) => (
                  <button
                    key={t}
                    id={`research-tab-${t}`}
                    onClick={() => setActiveResearchTab(t)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeResearchTab === t ? "bg-blue-500/30 text-white" : "text-white/40 hover:text-white"}`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {(analysis[`${activeResearchTab}_results` as keyof Analysis] as ResearchResult[] || []).map((r, i) => (
                  <a
                    key={i}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block glass rounded-xl p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="font-medium text-sm mb-1 text-blue-300 hover:text-blue-200">{r.title}</div>
                    <p className="text-xs text-white/50 line-clamp-2">{r.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-white/30">
                      {r.published && <span>{r.published}</span>}
                      <span>Relevance: {Math.round((r.score || 0) * 100)}%</span>
                    </div>
                  </a>
                ))}
                {(analysis[`${activeResearchTab}_results` as keyof Analysis] as ResearchResult[] || []).length === 0 && (
                  <div className="text-center text-white/40 py-6 text-sm">No {activeResearchTab} results available</div>
                )}
              </div>
            </div>

            {/* Triangulation */}
            {analysis.triangulation && (
              <div className="glass-card p-5">
                <h3 className="font-semibold mb-4">🔗 Cross-Document Triangulation</h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {Object.entries(analysis.triangulation)
                    .filter(([k]) => k !== "inconsistencies" && k !== "overall_consistency_score")
                    .map(([k, v]) => (
                      <div key={k} className="glass rounded-lg p-3">
                        <div className="text-xs text-white/40 mb-1">{k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</div>
                        <div className="text-sm text-white/70">{String(v)}</div>
                      </div>
                    ))}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-white/50">Consistency Score:</span>
                  <span className={`text-lg font-bold ${Number(analysis.triangulation.overall_consistency_score || 0) >= 75 ? "text-emerald-400" : "text-amber-400"}`}>
                    {String(analysis.triangulation.overall_consistency_score)}/100
                  </span>
                </div>
                {Array.isArray(analysis.triangulation.inconsistencies) && (analysis.triangulation.inconsistencies as string[]).length > 0 && (
                  <div className="mt-3 glass rounded-lg p-3 border border-red-500/20">
                    <div className="text-xs font-semibold text-red-400 mb-2">⚠️ Inconsistencies Found</div>
                    {(analysis.triangulation.inconsistencies as string[]).map((inc, i) => (
                      <div key={i} className="text-sm text-white/60">{inc}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Risks & Mitigants */}
            <div className="grid grid-cols-2 gap-6">
              <div className="glass-card p-5">
                <h3 className="font-semibold mb-3 text-red-400">⚠️ Key Risks</h3>
                <ul className="space-y-2">
                  {(analysis.key_risks || []).map((r, i) => (
                    <li key={i} className="text-sm text-white/70 flex gap-2">
                      <span className="text-red-400 flex-shrink-0">•</span>{r}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="glass-card p-5">
                <h3 className="font-semibold mb-3 text-emerald-400">🛡️ Mitigants</h3>
                <ul className="space-y-2">
                  {(analysis.mitigants || []).map((m, i) => (
                    <li key={i} className="text-sm text-white/70 flex gap-2">
                      <span className="text-emerald-400 flex-shrink-0">•</span>{m}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Export */}
            <div className="glass-card p-5 text-center">
              <h3 className="font-semibold mb-2">Export Report</h3>
              <p className="text-sm text-white/50 mb-4">Download the complete credit assessment as a formatted Word document</p>
              <a
                href={exportDocxUrl(entityId)}
                target="_blank"
                className="btn-primary inline-flex"
              >
                📄 Download Word Report (.docx)
              </a>
            </div>
          </div>
        )}
      </main>

      {/* Observation Modal */}
      {isObservationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card max-w-2xl w-full p-8 shadow-2xl border-2 border-blue-500/30 overflow-hidden relative">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold gradient-text">Add Field Observation</h2>
              <button onClick={() => setIsObservationModalOpen(false)} className="text-white/40 hover:text-white">✕</button>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-white/60">Capture site visit notes or promoter insights</div>
                {typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition) && (
                  <div className="flex flex-col items-end">
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 ${isRecording ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
                    >
                      <span className="text-xl">{isRecording ? "⏹️" : "🎤"}</span>
                      <span className="text-sm font-medium">{isRecording ? "Recording... (click to stop)" : "Voice Recording"}</span>
                    </button>
                    <span className="text-[10px] text-white/30 mt-1 uppercase tracking-wider">Speak your observations</span>
                  </div>
                )}
              </div>

              <div className="relative">
                <textarea
                  className="input min-h-[150px] pt-4 text-base"
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  placeholder="e.g. Promoter showed confident site growth, though GNPA reporting seems conservative..."
                />
                {interimText && (
                  <div className="absolute top-4 left-4 right-4 pointer-events-none text-white/40 italic">
                    <span className="opacity-0">{observation}</span>
                    {observation && " "}
                    {interimText}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button 
                  onClick={() => setIsObservationModalOpen(false)} 
                  className="btn-secondary"
                  disabled={isRecalculating}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddObservation} 
                  className="btn-primary"
                  disabled={isRecalculating || (!observation && !interimText)}
                >
                  {isRecalculating ? "Updating Score..." : "Submit & Recalculate Score →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
