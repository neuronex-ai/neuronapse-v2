-- Moltbook was an abandoned Synapse experiment. Keep the generic
-- synapse_activations table, but remove the provider-specific field.

alter table if exists public.synapse_activations
  drop column if exists moltbook_post_id;
