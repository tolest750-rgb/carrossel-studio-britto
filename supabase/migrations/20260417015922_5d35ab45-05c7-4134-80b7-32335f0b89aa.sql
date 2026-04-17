CREATE TABLE public.plan_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  from_plan text,
  to_plan text,
  amount_cents integer,
  currency text DEFAULT 'brl',
  stripe_invoice_id text,
  stripe_invoice_url text,
  environment text NOT NULL DEFAULT 'sandbox',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_plan_change_log_user ON public.plan_change_log(user_id);
CREATE INDEX idx_plan_change_log_created ON public.plan_change_log(created_at DESC);

ALTER TABLE public.plan_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own plan history"
  ON public.plan_change_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all plan history"
  ON public.plan_change_log FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Service role manages plan history"
  ON public.plan_change_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');