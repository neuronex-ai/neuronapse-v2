-- Adiciona a coluna working_hours na tabela profiles
ALTER TABLE "public"."profiles" 
ADD COLUMN IF NOT EXISTS "working_hours" jsonb DEFAULT '{
  "0": { "enabled": false, "start": "08:00", "end": "12:00" },
  "1": { "enabled": true, "start": "08:00", "end": "19:00" },
  "2": { "enabled": true, "start": "08:00", "end": "19:00" },
  "3": { "enabled": true, "start": "08:00", "end": "19:00" },
  "4": { "enabled": true, "start": "08:00", "end": "19:00" },
  "5": { "enabled": true, "start": "08:00", "end": "19:00" },
  "6": { "enabled": false, "start": "08:00", "end": "12:00" }
}'::jsonb;
