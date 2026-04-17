import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, ok } from "../_shared/cors.ts";
import { sendEmail, baseLayout } from "../_shared/resend.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { email, name, planType, amountCents, currency, invoiceUrl, invoicePdf, periodEnd } = body;
    if (!email) return ok({ error: "email required" }, 400);

    const valor = typeof amountCents === "number"
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: (currency || "BRL").toUpperCase() }).format(amountCents / 100)
      : "—";
    const planoLabel = planType === "anual" ? "Anual (12 meses)" : planType === "mensal" ? "Mensal" : (planType || "—");
    const proximaData = periodEnd ? new Date(periodEnd).toLocaleDateString("pt-BR") : "—";
    const linksHtml = invoiceUrl || invoicePdf
      ? `<p style="margin:0 0 6px;color:#888;font-size:12px">Comprovantes:</p>
         ${invoiceUrl ? `<p style="margin:0 0 6px"><a href="${invoiceUrl}" style="color:#00ff88;text-decoration:underline">Ver fatura no Stripe</a></p>` : ""}
         ${invoicePdf ? `<p style="margin:0 0 6px"><a href="${invoicePdf}" style="color:#00ff88;text-decoration:underline">Baixar recibo (PDF)</a></p>` : ""}`
      : "";

    const html = baseLayout({
      title: "Pagamento confirmado ✓",
      preheader: `Recebemos seu pagamento de ${valor}. Acesso liberado.`,
      bodyHtml: `
        <p style="margin:0 0 14px;color:#fff">${name ? `Olá, ${name}!` : "Olá!"}</p>
        <p style="margin:0 0 14px">Seu pagamento foi processado e seu acesso à <strong style="color:#00ff88">Máquina de Carrossel</strong> está ativo.</p>
        <table role="presentation" width="100%" style="margin:18px 0;border:1px solid rgba(0,255,136,0.25);border-radius:6px;background:rgba(0,255,136,0.04)">
          <tr><td style="padding:14px 18px;font-family:'Courier New',monospace;font-size:12px;color:#cccccc">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:#888;text-transform:uppercase;letter-spacing:2px;font-size:10px">Plano</span> <strong style="color:#fff">${planoLabel}</strong></div>
            <div style="margin-bottom:6px"><span style="color:#888;text-transform:uppercase;letter-spacing:2px;font-size:10px">Valor pago</span> <strong style="color:#00ff88;font-size:16px">${valor}</strong></div>
            <div><span style="color:#888;text-transform:uppercase;letter-spacing:2px;font-size:10px">Próxima cobrança</span> <strong style="color:#fff">${proximaData}</strong></div>
          </td></tr>
        </table>
        ${linksHtml}
      `,
      ctaUrl: "https://carrossel.brittogroup.com.br",
      ctaLabel: "Acessar painel",
    });

    const r = await sendEmail({ to: email, subject: `Pagamento confirmado — ${valor}`, html });
    if (!r.ok) return ok({ error: r.error }, 200);
    return ok({ success: true, id: r.id });
  } catch (e) {
    console.error("send-purchase-receipt error", e);
    return ok({ error: e instanceof Error ? e.message : "unknown" }, 200);
  }
});
