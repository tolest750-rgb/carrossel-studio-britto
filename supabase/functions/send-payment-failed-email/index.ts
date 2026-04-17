import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, ok } from "../_shared/cors.ts";
import { sendEmail, baseLayout } from "../_shared/resend.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const {
      email,
      name,
      planType,
      amountCents,
      currency,
      attemptCount,
      nextAttempt,
      portalUrl,
      hostedInvoiceUrl,
    } = body;
    if (!email) return ok({ error: "email required" }, 400);

    const labelPlan = planType === "anual" ? "Anual" : planType === "mensal" ? "Mensal" : (planType || "—");
    const amount = typeof amountCents === "number"
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: (currency || "brl").toUpperCase() })
          .format(amountCents / 100)
      : null;
    const next = nextAttempt ? new Date(nextAttempt).toLocaleDateString("pt-BR") : null;

    const subject = "⚠️ Falha no pagamento da sua assinatura";
    const cta = portalUrl || hostedInvoiceUrl || "https://carrossel.brittogroup.com.br/account";

    const inner = `
      <p style="margin:0 0 14px;color:#fff">${name ? `Olá, ${name}!` : "Olá!"}</p>
      <p style="margin:0 0 14px">Não conseguimos processar a cobrança da sua assinatura <strong>${labelPlan}</strong>${amount ? ` no valor de <strong style="color:#ff5577">${amount}</strong>` : ""}.</p>
      ${attemptCount ? `<p style="margin:0 0 14px">Esta foi a tentativa <strong>#${attemptCount}</strong>.</p>` : ""}
      ${next ? `<p style="margin:0 0 14px">Próxima tentativa automática: <strong style="color:#00ff88">${next}</strong>.</p>` : ""}
      <p style="margin:0 0 14px">Para evitar a interrupção do acesso, atualize seu cartão clicando no botão abaixo:</p>
      ${hostedInvoiceUrl ? `<p style="margin:14px 0 0;font-size:12px;color:#888">Você também pode pagar a fatura diretamente: <a href="${hostedInvoiceUrl}" style="color:#00ff88">ver fatura</a>.</p>` : ""}
    `;

    const html = baseLayout({
      title: "Falha na cobrança",
      preheader: subject,
      bodyHtml: inner,
      ctaUrl: cta,
      ctaLabel: "Atualizar cartão",
    });

    const r = await sendEmail({ to: email, subject, html });
    if (!r.ok) return ok({ error: r.error }, 200);
    return ok({ success: true, id: r.id });
  } catch (e) {
    console.error("send-payment-failed-email error", e);
    return ok({ error: e instanceof Error ? e.message : "unknown" }, 200);
  }
});
