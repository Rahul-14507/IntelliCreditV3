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

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      onboarding: "badge-gray",
      documents: "badge-blue",
      schema: "badge-purple",
      analysis: "badge-conditional",
      complete: "badge-approve",
    };
    return map[status] || "badge-gray";
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

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-sm shadow-lg shadow-blue-500/30">
            IC
          </div>
          <div>
            <h1 className="font-bold text-base">IntelliCredit</h1>
            <p className="text-xs text-white/40">v3 — AI Credit Analytics</p>
          </div>
        </div>
        <button
          id="new-application-btn"
          onClick={() => router.push("/onboard")}
          className="btn-primary"
        >
          <span>+</span> New Application
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero Stats */}
        <div className="mb-8 animate-slide-in">
          <h2 className="text-2xl font-bold mb-1">
            Credit <span className="gradient-text">Pipeline</span>
          </h2>
          <p className="text-white/50 text-sm mb-6">IIT Hyderabad Hackathon — Round 2</p>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Applications", value: stats.total, icon: "📋", color: "from-blue-500/20 to-blue-600/10" },
              { label: "Analysis Complete", value: stats.complete, icon: "✅", color: "from-emerald-500/20 to-emerald-600/10" },
              { label: "In Progress", value: stats.inProgress, icon: "⚡", color: "from-amber-500/20 to-amber-600/10" },
            ].map((stat) => (
              <div key={stat.label} className={`glass-card p-5 bg-gradient-to-br ${stat.color}`}>
                <div className="text-2xl mb-2">{stat.icon}</div>
                <div className="text-3xl font-bold">{stat.value}</div>
                <div className="text-sm text-white/50 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Applications Table */}
        <div className="glass-card overflow-hidden animate-slide-in" style={{ animationDelay: "0.1s" }}>
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-semibold">Applications</h3>
            <span className="text-sm text-white/40">{entities.length} total</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : entities.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🏦</div>
              <p className="text-white/50 mb-2">No applications yet</p>
              <p className="text-white/30 text-sm mb-6">Start by creating your first credit assessment</p>
              <button onClick={() => router.push("/onboard")} className="btn-primary">
                Create First Application
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Company", "CIN", "Sector", "Loan Amount", "Stage", "Actions"].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entities.map((entity, idx) => (
                    <tr
                      key={entity.id}
                      className="border-b border-white/5 hover:bg-white/3 transition-colors"
                      style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium">{entity.company_name}</div>
                        <div className="text-xs text-white/40">{entity.loan_type || "Term Loan"}</div>
                      </td>
                      <td className="px-6 py-4 text-white/60 font-mono text-xs">{entity.cin || "—"}</td>
                      <td className="px-6 py-4 text-white/70">{entity.sector || "—"}</td>
                      <td className="px-6 py-4 font-semibold text-blue-400">
                        ₹{entity.loan_amount_cr} Cr
                      </td>
                      <td className="px-6 py-4">
                        <span className={`badge ${getStatusColor(entity.status)}`}>
                          {entity.status.charAt(0).toUpperCase() + entity.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={getNextLink(entity)}
                            className="btn-secondary text-xs py-1.5 px-3"
                          >
                            {entity.status === "complete" ? "View Report" : "Continue →"}
                          </Link>
                          <button
                            onClick={() => handleDelete(entity.id, entity.company_name)}
                            className="btn-danger text-xs py-1.5 px-2"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pipeline stages visual */}
        <div className="mt-8 glass-card p-6 animate-slide-in" style={{ animationDelay: "0.2s" }}>
          <h3 className="font-semibold mb-4 text-white/80">Pipeline Stages</h3>
          <div className="grid grid-cols-4 gap-3">
            {[
              { stage: "1", name: "Entity Onboarding", desc: "CIN, PAN, Loan details", icon: "📝", color: "blue" },
              { stage: "2", name: "Document Ingestion", desc: "Upload 5 doc types + extraction", icon: "📄", color: "purple" },
              { stage: "3", name: "Schema & Extraction", desc: "AI classify → human review → structured data", icon: "🔍", color: "amber" },
              { stage: "4", name: "AI Credit Report", desc: "Tavily research → GPT-4o scoring → SWOT", icon: "🤖", color: "emerald" },
            ].map((s) => (
              <div key={s.stage} className="glass rounded-xl p-4 text-center hover:bg-white/5 transition-colors">
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className="text-xs text-white/40 mb-1">Stage {s.stage}</div>
                <div className="font-medium text-sm mb-1">{s.name}</div>
                <div className="text-xs text-white/40">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
