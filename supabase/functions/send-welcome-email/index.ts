import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, ok } from "../_shared/cors.ts";
import { sendEmail, baseLayout } from "../_shared/resend.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, name } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string") return ok({ error: "email required" }, 400);

    const greet = name ? `Olá, ${name}!` : "Bem-vindo(a)!";
    const appUrl = "https://carrossel.brittogroup.com.br";
    const html = baseLayout({
      title: "Bem-vindo à Máquina de Carrossel",
      preheader: "Sua conta foi criada. Hora de gerar carrosséis cinematográficos.",
      bodyHtml: `
        <p style="margin:0 0 14px;color:#fff"><strong>${greet}</strong></p>
        <p style="margin:0 0 14px">Sua conta na <strong style="color:#00ff88">BRITTO ★ STUDIO</strong> foi criada com sucesso.</p>
        <p style="margin:0 0 14px">Você está a um passo de gerar carrosséis em <strong>4K com IA Gemini Nano Banana Pro</strong> — em até 90 segundos por roteiro, com 4 variações por slide.</p>
        <p style="margin:0 0 14px">Próximo passo: escolha seu plano e libere acesso completo ao painel.</p>
      `,
      ctaUrl: `${appUrl}/pricing`,
      ctaLabel: "Escolher meu plano",
    });

    const r = await sendEmail({ to: email, subject: "Bem-vindo à Máquina de Carrossel ★", html });
    if (!r.ok) return ok({ error: r.error }, 200);
    return ok({ success: true, id: r.id });
  } catch (e) {
    console.error("send-welcome-email error", e);
    return ok({ error: e instanceof Error ? e.message : "unknown" }, 200);
  }
});
