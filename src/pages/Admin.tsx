import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Users, CheckCircle2, XCircle, RefreshCw, AlertTriangle, DollarSign } from "lucide-react";

interface UserRow {
  user_id: string;
  display_name: string | null;
  created_at: string;
  email?: string;
  status?: string;
  plan_type?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
}

export default function Admin() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [fees, setFees] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: subs }, { data: cancelFees }, { data: log }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, created_at").order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("user_id, status, plan_type, current_period_end, cancel_at_period_end"),
      supabase.from("cancellation_fees").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("plan_change_log").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    const subMap = new Map((subs || []).map((s: any) => [s.user_id, s]));
    const profMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
    setRows(
      (profiles || []).map((p: any) => ({
        ...p,
        ...(subMap.get(p.user_id) || { status: "inactive" }),
      }))
    );
    setFees(cancelFees || []);
    setHistory((log || []).map((h: any) => ({ ...h, display_name: profMap.get(h.user_id)?.display_name })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => {
    if (filter === "all") return true;
    const isActive = r.status === "active" || r.status === "trialing";
    return filter === "active" ? isActive : !isActive;
  });

  const stats = {
    total: rows.length,
    active: rows.filter((r) => r.status === "active" || r.status === "trialing").length,
    canceledScheduled: rows.filter((r) => r.cancel_at_period_end).length,
    feesPaid: fees.filter((f) => f.status === "paid").reduce((sum, f) => sum + f.amount_cents, 0),
  };

  const actionLabel = (a: string) => ({
    signup: "Cadastro pago", renewal: "Renovação", upgrade: "Upgrade",
    downgrade: "Downgrade", cancel: "Cancelamento",
  } as Record<string, string>)[a] || a;
  const actionColor = (a: string) => ({
    signup: "bg-primary/10 text-primary border-primary/30",
    renewal: "bg-primary/10 text-primary border-primary/30",
    upgrade: "bg-accent/10 text-accent border-accent/30",
    downgrade: "bg-warning/10 text-warning border-warning/30",
    cancel: "bg-destructive/10 text-destructive border-destructive/30",
  } as Record<string, string>)[a] || "bg-card2 text-muted-foreground border-border2";

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-[80px] pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-accent" />
              <div>
                <h1 className="font-logo text-2xl lg:text-3xl font-black tracking-[2px] text-foreground">
                  Painel Admin
                </h1>
                <p className="text-xs text-muted-foreground">Captura de cadastros e status de assinaturas</p>
              </div>
            </div>
            <button onClick={load} className="font-mono text-[10px] tracking-[2px] uppercase border border-border2 px-3 py-2 rounded-sm hover:border-primary hover:text-primary transition flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3" /> Atualizar
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <Stat icon={Users} label="Cadastros" value={stats.total} />
            <Stat icon={CheckCircle2} label="Assinaturas ativas" value={stats.active} color="text-primary" />
            <Stat icon={AlertTriangle} label="Cancelamentos agendados" value={stats.canceledScheduled} color="text-warning" />
            <Stat icon={DollarSign} label="Multas pagas" value={`R$ ${(stats.feesPaid / 100).toFixed(2)}`} color="text-accent" />
          </div>

          {/* Filter */}
          <div className="flex gap-2 mb-4">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`font-mono text-[10px] tracking-[2px] uppercase px-3 py-1.5 rounded-sm border transition ${
                  filter === f ? "border-primary bg-primary/10 text-primary" : "border-border2 text-muted-foreground hover:border-primary/50"
                }`}>
                {f === "all" ? "Todos" : f === "active" ? "Ativos" : "Inativos"}
              </button>
            ))}
          </div>

          <div className="border border-border2 rounded-sm overflow-x-auto bg-card">
            <table className="w-full text-xs">
              <thead className="bg-card2 border-b border-border2">
                <tr className="font-mono uppercase tracking-wider text-[10px] text-muted-foreground">
                  <th className="text-left px-3 py-2">Nome</th>
                  <th className="text-left px-3 py-2">Cadastro</th>
                  <th className="text-left px-3 py-2">Plano</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Próx. cobrança</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-muted-foreground py-8">Nenhum registro</td></tr>
                ) : (
                  filtered.map((r) => {
                    const active = r.status === "active" || r.status === "trialing";
                    return (
                      <tr key={r.user_id} className="border-b border-border2/50 hover:bg-card2">
                        <td className="px-3 py-2 font-mono text-foreground">
                          {r.display_name || "—"}
                          <div className="text-[10px] text-muted-foreground">{r.user_id.slice(0, 8)}...</div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(r.created_at).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-3 py-2 font-mono uppercase tracking-wider text-[10px]">
                          {r.plan_type || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm ${
                            active ? "bg-primary/10 text-primary border border-primary/30"
                              : "bg-destructive/10 text-destructive border border-destructive/30"
                          }`}>
                            {active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {r.status || "inactive"}
                          </span>
                          {r.cancel_at_period_end && (
                            <div className="text-[9px] text-warning mt-1 font-mono">cancel agendado</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {r.current_period_end ? new Date(r.current_period_end).toLocaleDateString("pt-BR") : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {fees.length > 0 && (
            <div className="mt-8">
              <h2 className="font-mono text-xs tracking-[2px] uppercase text-foreground mb-3">Multas de cancelamento (últimas 50)</h2>
              <div className="border border-border2 rounded-sm overflow-x-auto bg-card">
                <table className="w-full text-xs">
                  <thead className="bg-card2 border-b border-border2">
                    <tr className="font-mono uppercase tracking-wider text-[10px] text-muted-foreground">
                      <th className="text-left px-3 py-2">Data</th>
                      <th className="text-left px-3 py-2">Usuário</th>
                      <th className="text-left px-3 py-2">Plano</th>
                      <th className="text-left px-3 py-2">Valor</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-left px-3 py-2">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fees.map((f) => (
                      <tr key={f.id} className="border-b border-border2/50">
                        <td className="px-3 py-2 text-muted-foreground">{new Date(f.created_at).toLocaleDateString("pt-BR")}</td>
                        <td className="px-3 py-2 font-mono">{f.user_id.slice(0, 8)}...</td>
                        <td className="px-3 py-2 uppercase">{f.plan_type}</td>
                        <td className="px-3 py-2 text-foreground">R$ {(f.amount_cents / 100).toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <span className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded-sm ${
                            f.status === "paid" ? "bg-primary/10 text-primary"
                              : f.status === "failed" ? "bg-destructive/10 text-destructive"
                              : "bg-warning/10 text-warning"
                          }`}>{f.status}</span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground text-[10px]">{f.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Plan change history */}
          <div className="mt-8">
            <h2 className="font-mono text-xs tracking-[2px] uppercase text-foreground mb-3">
              Histórico de Planos {history.length > 0 ? `(${history.length})` : ""}
            </h2>
            <div className="border border-border2 rounded-sm overflow-x-auto bg-card">
              <table className="w-full text-xs">
                <thead className="bg-card2 border-b border-border2">
                  <tr className="font-mono uppercase tracking-wider text-[10px] text-muted-foreground">
                    <th className="text-left px-3 py-2">Data</th>
                    <th className="text-left px-3 py-2">Usuário</th>
                    <th className="text-left px-3 py-2">Ação</th>
                    <th className="text-left px-3 py-2">De → Para</th>
                    <th className="text-left px-3 py-2">Valor</th>
                    <th className="text-left px-3 py-2">Fatura</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma alteração registrada</td></tr>
                  ) : history.map((h) => (
                    <tr key={h.id} className="border-b border-border2/50">
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{new Date(h.created_at).toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-2 font-mono">{h.display_name || `${h.user_id.slice(0, 8)}...`}</td>
                      <td className="px-3 py-2">
                        <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm border ${actionColor(h.action)}`}>
                          {actionLabel(h.action)}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono uppercase text-[10px] text-foreground">
                        {h.from_plan || "—"} → {h.to_plan || "—"}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {h.amount_cents ? `R$ ${(h.amount_cents / 100).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {h.stripe_invoice_url
                          ? <a href={h.stripe_invoice_url} target="_blank" rel="noreferrer" className="text-primary hover:underline font-mono text-[10px]">Ver</a>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function Stat({ icon: Icon, label, value, color = "text-foreground" }: any) {
  return (
    <div className="border border-border2 rounded-sm bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] tracking-[2px] uppercase mb-2">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className={`text-2xl font-black ${color}`}>{value}</div>
    </div>
  );
}
