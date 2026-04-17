import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, ok } from "../_shared/cors.ts";
import { sendEmail, baseLayout } from "../_shared/resend.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { email, name, action, fromPlan, toPlan, effectiveAt, accessUntil } = body;
    if (!email || !action) return ok({ error: "email and action required" }, 400);

    const labelPlan = (p?: string | null) => p === "anual" ? "Anual" : p === "mensal" ? "Mensal" : (p || "—");
    const eff = effectiveAt ? new Date(effectiveAt).toLocaleDateString("pt-BR") : null;
    const until = accessUntil ? new Date(accessUntil).toLocaleDateString("pt-BR") : null;

    let title = "";
    let inner = "";
    let subject = "";
    if (action === "upgrade") {
      title = "Upgrade confirmado ⚡";
      subject = "Upgrade de plano confirmado";
      inner = `<p style="margin:0 0 14px">Você fez upgrade de <strong>${labelPlan(fromPlan)}</strong> para <strong style="color:#00ff88">${labelPlan(toPlan)}</strong>.</p>
        <p style="margin:0 0 14px">A mudança é imediata e a cobrança proporcional já foi processada.</p>`;
    } else if (action === "downgrade") {
      title = "Downgrade agendado";
      subject = "Mudança de plano agendada";
      inner = `<p style="margin:0 0 14px">Seu plano vai mudar de <strong>${labelPlan(fromPlan)}</strong> para <strong style="color:#00ff88">${labelPlan(toPlan)}</strong>${eff ? ` em <strong>${eff}</strong>` : ""}.</p>
        <p style="margin:0 0 14px">Até lá você mantém os benefícios do plano atual.</p>`;
    } else if (action === "cancel") {
      title = "Cancelamento confirmado";
      subject = "Sua assinatura foi cancelada";
      inner = `<p style="margin:0 0 14px">Sua assinatura <strong>${labelPlan(fromPlan)}</strong> foi cancelada.</p>
        ${until ? `<p style="margin:0 0 14px">Você mantém acesso até <strong style="color:#00ff88">${until}</strong>.</p>` : ""}
        <p style="margin:0 0 14px">Mudou de ideia? Você pode reativar a qualquer momento.</p>`;
    } else {
      title = "Atualização de plano";
      subject = "Sua assinatura foi atualizada";
      inner = `<p style="margin:0 0 14px">Sua assinatura foi atualizada.</p>`;
    }

    const html = baseLayout({
      title,
      preheader: subject,
      bodyHtml: `<p style="margin:0 0 14px;color:#fff">${name ? `Olá, ${name}!` : "Olá!"}</p>${inner}`,
      ctaUrl: "https://carrossel.brittogroup.com.br/account",
      ctaLabel: "Ver minha conta",
    });

    const r = await sendEmail({ to: email, subject, html });
    if (!r.ok) return ok({ error: r.error }, 200);
    return ok({ success: true, id: r.id });
  } catch (e) {
    console.error("send-plan-change-email error", e);
    return ok({ error: e instanceof Error ? e.message : "unknown" }, 200);
  }
});
