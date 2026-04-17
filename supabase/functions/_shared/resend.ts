// Shared Resend gateway helper for transactional emails.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM_DEFAULT = "BRITTO Studio <noreply@brittogroup.com.br>";

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  reply_to?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ ok: boolean; id?: string; error?: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!LOVABLE_API_KEY) return { ok: false, error: "LOVABLE_API_KEY not configured" };
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY not configured" };

  try {
    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: params.from || FROM_DEFAULT,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
        ...(params.reply_to ? { reply_to: params.reply_to } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Resend send failed", res.status, data);
      return { ok: false, error: `Resend ${res.status}: ${JSON.stringify(data)}` };
    }
    return { ok: true, id: data.id };
  } catch (e) {
    console.error("Resend send exception", e);
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

// ----- Shared HTML template (cyberpunk neon green) -----
export function baseLayout(opts: { title: string; preheader?: string; bodyHtml: string; ctaUrl?: string; ctaLabel?: string }): string {
  const { title, preheader = "", bodyHtml, ctaUrl, ctaLabel } = opts;
  const cta = ctaUrl && ctaLabel
    ? `<tr><td align="center" style="padding:24px 0 8px"><a href="${ctaUrl}" style="display:inline-block;background:#00ff88;color:#000;font-family:'Courier New',monospace;font-weight:900;letter-spacing:2px;text-transform:uppercase;font-size:12px;padding:14px 28px;border-radius:4px;text-decoration:none;border:1px solid #00ff88;box-shadow:0 0 24px rgba(0,255,136,0.4)">${ctaLabel}</a></td></tr>`
    : "";
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<div style="display:none;font-size:1px;color:#fff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0a0a0a;border:1px solid #00ff88;border-radius:8px;overflow:hidden;box-shadow:0 8px 60px rgba(0,255,136,0.18)">
    <tr><td style="padding:28px 32px 18px;text-align:center;border-bottom:1px solid rgba(0,255,136,0.2)">
      <div style="font-family:'Courier New',monospace;font-weight:900;letter-spacing:4px;font-size:18px;color:#ffffff">BRITTO <span style="color:#00ff88;text-shadow:0 0 12px #00ff88">★</span> STUDIO</div>
      <div style="font-family:'Courier New',monospace;letter-spacing:3px;font-size:9px;color:#888;margin-top:4px;text-transform:uppercase">CARROSSEL ENGINE</div>
    </td></tr>
    <tr><td style="padding:32px 32px 8px;color:#ffffff">
      <h1 style="margin:0 0 16px;font-family:'Courier New',monospace;font-weight:900;letter-spacing:1px;font-size:22px;color:#ffffff">${title}</h1>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#cccccc">${bodyHtml}</div>
    </td></tr>
    ${cta}
    <tr><td style="padding:24px 32px 28px;border-top:1px solid rgba(0,255,136,0.15);text-align:center">
      <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:2px;color:#666;text-transform:uppercase">BRITTO Group · brittogroup.com.br</div>
      <div style="font-family:Arial,sans-serif;font-size:10px;color:#555;margin-top:6px">Você recebeu este e-mail porque tem uma conta na Máquina de Carrossel.</div>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}
