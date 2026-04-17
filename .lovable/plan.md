
User verified domain at Resend and has API key ready. Plan: connect Resend, then implement 4 emails + admin history.

## Plan

### 1. Connect Resend
Use connector to link Resend → exposes `RESEND_API_KEY` env var.

### 2. Database: plan change history
New table `plan_change_log` (user_id, from_plan, to_plan, action: signup/upgrade/downgrade/cancel, amount_cents, stripe_invoice_id, environment, created_at) with RLS: users see own, admin sees all.

### 3. Edge Functions (4 emails via Resend gateway)
Create `send-email` shared helper + 4 functions (or 1 generic dispatcher with `type` param):
- `send-welcome-email` — triggered on signup
- `send-purchase-receipt` — triggered from `payments-webhook` on `invoice.paid` (subscription)
- `send-plan-change-email` — triggered from `change-plan` after success
- All use Resend gateway: `https://connector-gateway.lovable.dev/resend/emails`
- From: `BRITTO Studio <noreply@brittogroup.com.br>`
- HTML templates with neon/cyberpunk styling matching app

### 4. Wire triggers
- **Welcome**: in `Auth.tsx` after successful signup → invoke `send-welcome-email`
- **Receipt**: in `payments-webhook` on `invoice.paid` → fetch invoice PDF URL from Stripe → invoke `send-purchase-receipt` + insert `plan_change_log` (signup/renewal)
- **Plan change**: in `change-plan` after Stripe update succeeds → invoke `send-plan-change-email` + insert `plan_change_log`
- **Cancel**: in `cancel-subscription` after success → log to `plan_change_log`

### 5. Admin UI: plan history
Add tab/section to `/admin` "Histórico de Planos" showing `plan_change_log` joined with profiles (email, action badge, dates, amounts, stripe invoice link).

## Technical notes
- Resend gateway pattern: `Authorization: Bearer ${LOVABLE_API_KEY}` + `X-Connection-Api-Key: ${RESEND_API_KEY}`
- All edge functions: CORS, return 200+JSON errors, idempotent
- Email failures must NOT block payment/auth flows — wrap in try/catch
- Set `verify_jwt = false` for the email functions in `config.toml`
- Stripe receipt: use `invoice.hosted_invoice_url` and `invoice.invoice_pdf` directly in email

## Files to create/edit
- **New**: `supabase/functions/send-welcome-email/index.ts`
- **New**: `supabase/functions/send-purchase-receipt/index.ts`
- **New**: `supabase/functions/send-plan-change-email/index.ts`
- **New**: `supabase/functions/_shared/resend.ts` (gateway helper)
- **Migration**: create `plan_change_log` + RLS
- **Edit**: `supabase/functions/payments-webhook/index.ts` (call receipt + log)
- **Edit**: `supabase/functions/change-plan/index.ts` (call plan change email + log)
- **Edit**: `supabase/functions/cancel-subscription/index.ts` (log entry)
- **Edit**: `src/pages/Auth.tsx` (call welcome on signup)
- **Edit**: `src/pages/Admin.tsx` (history section)
- **Edit**: `supabase/config.toml` (3 new functions verify_jwt=false)

After approval I'll: connect Resend → migration → edge functions → wire triggers → admin UI.
