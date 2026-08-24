CREATE TABLE IF NOT EXISTS public.financial_requirement_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    financial_account_id UUID NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
    stripe_account_id VARCHAR(255) NOT NULL,
    currently_due JSONB DEFAULT '[]'::jsonb,
    eventually_due JSONB DEFAULT '[]'::jsonb,
    past_due JSONB DEFAULT '[]'::jsonb,
    pending_verification JSONB DEFAULT '[]'::jsonb,
    disabled_reason VARCHAR(255),
    current_deadline TIMESTAMP WITH TIME ZONE,
    details_submitted BOOLEAN DEFAULT false,
    charges_enabled BOOLEAN DEFAULT false,
    payouts_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (stripe_account_id)
);

-- RLS
ALTER TABLE public.financial_requirement_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own financial requirement snapshots"
    ON public.financial_requirement_snapshots FOR SELECT
    USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_financial_requirement_snapshots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_financial_requirement_snapshots_updated_at
    BEFORE UPDATE ON public.financial_requirement_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION update_financial_requirement_snapshots_updated_at();

-- Add index
CREATE INDEX IF NOT EXISTS idx_fin_req_snapshots_user_id ON public.financial_requirement_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_fin_req_snapshots_account_id ON public.financial_requirement_snapshots(financial_account_id);
