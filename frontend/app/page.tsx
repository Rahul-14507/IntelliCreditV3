"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { listEntities, deleteEntity } from "@/lib/api";
import { Entity } from "@/lib/types";

export default function Dashboard() {
  const router = useRouter();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEntities();
  }, []);

  async function fetchEntities() {
    try {
      const data = await listEntities() as Entity[];
      setEntities(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete application for ${name}?`)) return;
    try {
      await deleteEntity(id);
      setEntities((prev) => prev.filter((e) => e.id !== id));
    } catch {
      alert("Delete failed");
    }
  }

  const stats = {
    total: entities.length,
    complete: entities.filter((e) => e.status === "complete").length,
    inProgress: entities.filter((e) => !["complete", "onboarding"].includes(e.status)).length,
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; cls: string; dot: string }> = {
      onboarding: { label: "Onboarding", cls: "badge-gray", dot: "bg-slate-400" },
      documents: { label: "Documents", cls: "badge-blue", dot: "bg-blue-400" },
      schema: { label: "Schema", cls: "badge-purple", dot: "bg-purple-400" },
      analysis: { label: "Analysis", cls: "badge-conditional", dot: "bg-amber-400" },
      complete: { label: "Complete", cls: "badge-approve", dot: "bg-emerald-400" },
    };
    return configs[status] || { label: status, cls: "badge-gray", dot: "bg-slate-400" };
  };

  const getNextLink = (entity: Entity) => {
    const map: Record<string, string> = {
      onboarding: `/documents/${entity.id}`,
      documents: `/documents/${entity.id}`,
      schema: `/schema/${entity.id}`,
      analysis: `/report/${entity.id}`,
      complete: `/report/${entity.id}`,
    };
    return map[entity.status] || `/documents/${entity.id}`;
  };

  const getStageNumber = (status: string) => {
    const map: Record<string, number> = { onboarding: 1, documents: 2, schema: 3, analysis: 4, complete: 4 };
    return map[status] || 1;
  };

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #060B18 0%, #0A1128 40%, #060B18 100%)" }}>

      {/* Ambient Glow Background */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(37,99,235,0.15) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(124,58,237,0.1) 0%, transparent 60%)"
      }} />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 px-6 py-4" style={{
        background: "rgba(6, 11, 24, 0.8)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)"
      }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* SVG Logo */}
            <div style={{ position: "relative", width: 42, height: 42, flexShrink: 0 }}>
              <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="logoGrad" x1="0" y1="0" x2="42" y2="42" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#2563EB"/>
                    <stop offset="100%" stopColor="#7C3AED"/>
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="2" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>
                {/* Background */}
                <rect width="42" height="42" rx="11" fill="url(#logoGrad)" opacity="0.15"/>
                <rect width="42" height="42" rx="11" fill="none" stroke="url(#logoGrad)" strokeWidth="1.2" opacity="0.6"/>
                {/* Graph/Network nodes */}
                <circle cx="21" cy="14" r="3.2" fill="#60A5FA" filter="url(#glow)"/>
                <circle cx="13" cy="25" r="2.4" fill="#A78BFA" filter="url(#glow)"/>
                <circle cx="29" cy="25" r="2.4" fill="#34D399" filter="url(#glow)"/>
                <circle cx="21" cy="30" r="1.8" fill="#60A5FA" opacity="0.7"/>
                {/* Connecting lines */}
                <line x1="21" y1="17" x2="13" y2="23" stroke="rgba(96,165,250,0.4)" strokeWidth="1" strokeLinecap="round"/>
                <line x1="21" y1="17" x2="29" y2="23" stroke="rgba(167,139,250,0.4)" strokeWidth="1" strokeLinecap="round"/>
                <line x1="14.5" y1="26.5" x2="20" y2="29" stroke="rgba(96,165,250,0.3)" strokeWidth="1" strokeLinecap="round"/>
                <line x1="27.5" y1="26.5" x2="22" y2="29" stroke="rgba(52,211,153,0.3)" strokeWidth="1" strokeLinecap="round"/>
                {/* Upward trend arrow */}
                <polyline points="12,33 17,28 22,30 30,22" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.8"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.03em", color: "white" }}>IntelliCredit</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>AI Credit Intelligence</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div style={{
              padding: "5px 12px", borderRadius: 999,
              background: "rgba(52, 211, 153, 0.1)", border: "1px solid rgba(52,211,153,0.3)",
              fontSize: 11, color: "#34D399", fontWeight: 600, letterSpacing: "0.06em"
            }}>
              ● LIVE
            </div>
            <div style={{
              padding: "5px 12px", borderRadius: 999,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 500,
            }}>
              IIT Hyderabad — Round 2
            </div>
            <button
              id="new-application-btn"
              onClick={() => router.push("/onboard")}
              style={{
                background: "linear-gradient(135deg, #2563EB, #7C3AED)",
                color: "white", padding: "9px 20px", borderRadius: 10,
                fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                boxShadow: "0 4px 20px rgba(37,99,235,0.35)",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = "translateY(-1px)"; (e.target as HTMLElement).style.boxShadow = "0 6px 28px rgba(37,99,235,0.5)"; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = ""; (e.target as HTMLElement).style.boxShadow = "0 4px 20px rgba(37,99,235,0.35)"; }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> New Application
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-10">

        {/* Hero Section */}
        <div style={{ marginBottom: 40 }} className="animate-slide-in">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "rgba(96,165,250,0.7)", textTransform: "uppercase", marginBottom: 8 }}>
                Credit Intelligence Platform
              </div>
              <h1 style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.05, margin: 0 }}>
                <span style={{ color: "rgba(255,255,255,0.92)" }}>Credit</span>
                <br/>
                <span style={{
                  background: "linear-gradient(90deg, #3B82F6 0%, #8B5CF6 45%, #10B981 100%)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                  filter: "drop-shadow(0 0 24px rgba(59,130,246,0.5))",
                  letterSpacing: "-0.05em"
                }}>Pipeline</span>
              </h1>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginTop: 8 }}>
                Multi-stage AI-driven credit assessment and analysis engine
              </p>
            </div>

            {/* Pipeline flow diagram */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {[
                { n: "1", label: "Onboard", icon: "📝", color: "#60A5FA" },
                { n: "2", label: "Docs", icon: "📄", color: "#A78BFA" },
                { n: "3", label: "Schema", icon: "🔍", color: "#F59E0B" },
                { n: "4", label: "Report", icon: "🤖", color: "#34D399" },
              ].map((s, i) => (
                <div key={s.n} style={{ display: "flex", alignItems: "center" }}>
                  <div style={{
                    textAlign: "center", padding: "8px 14px",
                    background: `rgba(0,0,0,0.4)`,
                    border: `1px solid ${s.color}30`,
                    borderRadius: 10,
                    boxShadow: `0 0 16px ${s.color}15`
                  }}>
                    <div style={{ fontSize: 18 }}>{s.icon}</div>
                    <div style={{ fontSize: 9, color: s.color, fontWeight: 700, marginTop: 2, letterSpacing: "0.05em" }}>STAGE {s.n}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 1 }}>{s.label}</div>
                  </div>
                  {i < 3 && <div style={{ width: 20, height: 1, background: "linear-gradient(90deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05))", flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }} className="animate-slide-in">
          {[
            {
              label: "Total Applications", value: loading ? "—" : stats.total,
              sub: "All pipeline entries",
              icon: "📋",
              gradient: "linear-gradient(135deg, rgba(37,99,235,0.25) 0%, rgba(37,99,235,0.05) 100%)",
              border: "rgba(37,99,235,0.3)",
              glow: "rgba(37,99,235,0.1)",
              valueColor: "#60A5FA"
            },
            {
              label: "Analysis Complete", value: loading ? "—" : stats.complete,
              sub: "Reports generated",
              icon: "✅",
              gradient: "linear-gradient(135deg, rgba(52,211,153,0.25) 0%, rgba(52,211,153,0.05) 100%)",
              border: "rgba(52,211,153,0.3)",
              glow: "rgba(52,211,153,0.1)",
              valueColor: "#34D399"
            },
            {
              label: "In Progress", value: loading ? "—" : stats.inProgress,
              sub: "Awaiting completion",
              icon: "⚡",
              gradient: "linear-gradient(135deg, rgba(251,191,36,0.25) 0%, rgba(251,191,36,0.05) 100%)",
              border: "rgba(251,191,36,0.3)",
              glow: "rgba(251,191,36,0.1)",
              valueColor: "#FCD34D"
            }
          ].map((stat) => (
            <div key={stat.label} style={{
              background: stat.gradient,
              border: `1px solid ${stat.border}`,
              borderRadius: 16,
              padding: "24px 28px",
              boxShadow: `0 8px 32px ${stat.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`,
              position: "relative",
              overflow: "hidden"
            }}>
              <div style={{ position: "absolute", top: -10, right: -10, fontSize: 56, opacity: 0.07 }}>{stat.icon}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 44, fontWeight: 800, color: stat.valueColor, lineHeight: 1, letterSpacing: "-0.03em" }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* Applications Section */}
        <div style={{
          background: "rgba(13, 21, 38, 0.7)",
          border: "1px solid rgba(37, 99, 235, 0.15)",
          borderRadius: 20,
          overflow: "hidden",
          backdropFilter: "blur(20px)",
          boxShadow: "0 8px 48px rgba(0,0,0,0.4)",
          animationDelay: "0.1s"
        }} className="animate-slide-in">

          {/* Section Header */}
          <div style={{
            padding: "20px 28px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(255,255,255,0.02)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15
              }}>🏦</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "white" }}>Applications</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>Active credit pipeline entries</div>
              </div>
            </div>
            <div style={{
              padding: "4px 12px", background: "rgba(255,255,255,0.05)",
              borderRadius: 999, border: "1px solid rgba(255,255,255,0.08)",
              fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 600
            }}>
              {loading ? "..." : `${entities.length} total`}
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 16 }}>
              <div style={{
                width: 44, height: 44,
                borderRadius: "50%",
                border: "3px solid rgba(37,99,235,0.2)",
                borderTopColor: "#2563EB",
                animation: "spin 0.8s linear infinite"
              }} />
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Fetching applications...</div>
            </div>
          )}

          {/* Empty State */}
          {!loading && entities.length === 0 && (
            <div style={{ textAlign: "center", padding: "80px 24px" }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🏦</div>
              <div style={{ fontWeight: 700, fontSize: 20, color: "rgba(255,255,255,0.8)", marginBottom: 8 }}>No Applications Yet</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, marginBottom: 32, maxWidth: 360, margin: "0 auto 32px" }}>
                Start your first AI-powered credit assessment. Our engine will handle research, scoring, and report generation.
              </div>
              <button onClick={() => router.push("/onboard")} style={{
                background: "linear-gradient(135deg, #2563EB, #7C3AED)",
                color: "white", padding: "12px 28px", borderRadius: 12,
                fontWeight: 600, fontSize: 15, border: "none", cursor: "pointer",
                boxShadow: "0 4px 20px rgba(37,99,235,0.4)"
              }}>
                ✦ Start First Assessment
              </button>
            </div>
          )}

          {/* Applications Grid */}
          {!loading && entities.length > 0 && (
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              {entities.map((entity, idx) => {
                const statusCfg = getStatusConfig(entity.status);
                const nextLink = getNextLink(entity);
                const stage = getStageNumber(entity.status);
                const isComplete = entity.status === "complete";

                return (
                  <div
                    key={entity.id}
                    style={{
                      background: isComplete ? "rgba(52,211,153,0.04)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${isComplete ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.06)"}`,
                      borderRadius: 14,
                      padding: "16px 20px",
                      display: "flex", alignItems: "center", gap: 16,
                      transition: "all 0.2s ease",
                      cursor: "default",
                      animation: `fade-in 0.35s ease-out ${idx * 0.05}s both`
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = isComplete ? "rgba(52,211,153,0.07)" : "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.borderColor = isComplete ? "rgba(52,211,153,0.25)" : "rgba(37,99,235,0.2)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isComplete ? "rgba(52,211,153,0.04)" : "rgba(255,255,255,0.02)"; (e.currentTarget as HTMLElement).style.borderColor = isComplete ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.06)"; }}
                  >
                    {/* Company Avatar */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                      background: `linear-gradient(135deg, hsl(${(entity.company_name.charCodeAt(0) * 7) % 360}, 60%, 30%), hsl(${(entity.company_name.charCodeAt(0) * 7 + 60) % 360}, 60%, 20%))`,
                      border: "1px solid rgba(255,255,255,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: 15, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.02em"
                    }}>
                      {entity.company_name.substring(0, 2).toUpperCase()}
                    </div>

                    {/* Company Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {entity.company_name}
                        </span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", flexShrink: 0 }}>{entity.sector || "—"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>{entity.cin || "CIN N/A"}</span>
                        <span style={{ fontSize: 11, color: "#60A5FA", fontWeight: 700 }}>₹{entity.loan_amount_cr} Cr</span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{entity.loan_type || "Term Loan"}</span>
                      </div>
                    </div>

                    {/* Stage Progress */}
                    <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                      {[1, 2, 3, 4].map((s) => (
                        <div key={s} style={{
                          width: 20, height: 4, borderRadius: 2,
                          background: s <= stage
                            ? isComplete ? "#34D399" : "#2563EB"
                            : "rgba(255,255,255,0.1)"
                        }} />
                      ))}
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginLeft: 4 }}>S{stage}</span>
                    </div>

                    {/* Status Badge */}
                    <div style={{ flexShrink: 0 }}>
                      <span className={`badge ${statusCfg.cls}`} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                        {statusCfg.label}
                      </span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <Link
                        href={nextLink}
                        style={{
                          padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                          background: isComplete ? "rgba(52,211,153,0.15)" : "rgba(37,99,235,0.15)",
                          border: `1px solid ${isComplete ? "rgba(52,211,153,0.3)" : "rgba(37,99,235,0.3)"}`,
                          color: isComplete ? "#34D399" : "#60A5FA",
                          textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                          transition: "all 0.15s ease", whiteSpace: "nowrap"
                        }}
                      >
                        {isComplete ? "📄 View Report" : "Continue →"}
                      </Link>
                      <button
                        onClick={() => handleDelete(entity.id, entity.company_name)}
                        style={{
                          width: 30, height: 30, borderRadius: 8, cursor: "pointer",
                          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                          color: "rgba(239,68,68,0.6)", fontSize: 12, fontWeight: 600,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.15s ease"
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.2)"; (e.currentTarget as HTMLElement).style.color = "#F87171"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)"; (e.currentTarget as HTMLElement).style.color = "rgba(239,68,68,0.6)"; }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Feature Strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 24 }} className="animate-slide-in">
          {[
            { icon: "🔍", label: "Tavily Research", desc: "Real-time web intelligence", color: "#60A5FA" },
            { icon: "🤖", label: "GPT-4o Scoring", desc: "7-step reasoning chain", color: "#A78BFA" },
            { icon: "🛡️", label: "Doc Consistency", desc: "Cross-document audit", color: "#34D399" },
            { icon: "⚡", label: "Scenario Sim", desc: "What-if credit modeling", color: "#F59E0B" },
          ].map((f) => (
            <div key={f.label} style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: `${f.color}15`, border: `1px solid ${f.color}25`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18
              }}>{f.icon}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: f.color }}>{f.label}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
