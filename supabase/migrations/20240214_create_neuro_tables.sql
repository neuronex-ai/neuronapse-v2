-- Create tables for NeuroFlow, NeuroView, and NeuroPulse persistence

-- NeuroFlow: Stores flow diagrams
CREATE TABLE IF NOT EXISTS public.neuro_flows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    nodes JSONB DEFAULT '[]'::jsonb,
    edges JSONB DEFAULT '[]'::jsonb,
    viewport JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- NeuroView: Stores configuration for physics and visualization
CREATE TABLE IF NOT EXISTS public.neuro_view_configs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    config JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_user_config UNIQUE(user_id)
);

-- NeuroPulse: Stores pulse data entries
CREATE TABLE IF NOT EXISTS public.neuro_pulse_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.neuro_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neuro_view_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neuro_pulse_entries ENABLE ROW LEVEL SECURITY;

-- Policies for NeuroFlow
CREATE POLICY "Users can view own flows" ON public.neuro_flows
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flows" ON public.neuro_flows
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own flows" ON public.neuro_flows
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own flows" ON public.neuro_flows
    FOR DELETE USING (auth.uid() = user_id);

-- Policies for NeuroView Config
CREATE POLICY "Users can view own config" ON public.neuro_view_configs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own config" ON public.neuro_view_configs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own config" ON public.neuro_view_configs
    FOR UPDATE USING (auth.uid() = user_id);

-- Policies for NeuroPulse
CREATE POLICY "Users can view own pulse entries" ON public.neuro_pulse_entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pulse entries" ON public.neuro_pulse_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pulse entries" ON public.neuro_pulse_entries
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pulse entries" ON public.neuro_pulse_entries
    FOR DELETE USING (auth.uid() = user_id);
