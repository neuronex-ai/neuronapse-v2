ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

UPDATE public.appointments
SET metadata = COALESCE(metadata, '{}'::jsonb);

UPDATE public.appointments
SET status = CASE
  WHEN status IN (
    'unscored',
    'attended',
    'absent',
    'cancelled_by_patient',
    'cancelled_by_professional'
  ) THEN status
  WHEN status = 'completed' THEN 'attended'
  WHEN status = 'no_show' THEN 'absent'
  WHEN status = 'cancelled' AND (
    lower(COALESCE(notes, '')) LIKE '%paciente%'
    OR lower(COALESCE(notes, '')) LIKE '%cliente%'
    OR lower(COALESCE(notes, '')) LIKE '%patient%'
  ) THEN 'cancelled_by_patient'
  WHEN status = 'cancelled' THEN 'cancelled_by_professional'
  ELSE 'unscored'
END;

UPDATE public.appointments
SET metadata = metadata || jsonb_build_object(
  'kind',
  CASE
    WHEN patient_id IS NOT NULL AND type <> 'block' THEN 'session'
    WHEN notes LIKE '%[EVENT]%' THEN 'event'
    WHEN type = 'block' THEN 'block'
    ELSE 'session'
  END,
  'origin',
  CASE
    WHEN google_event_id IS NOT NULL THEN 'google'
    ELSE 'neuronex'
  END,
  'syncStatus',
  CASE
    WHEN google_event_id IS NOT NULL THEN 'synced'
    ELSE 'pending'
  END
)
WHERE metadata ? 'kind' = false;

ALTER TABLE public.appointments
ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointments_status_canonical_check'
      AND conrelid = 'public.appointments'::regclass
  ) THEN
    ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_status_canonical_check
    CHECK (
      status IN (
        'unscored',
        'attended',
        'absent',
        'cancelled_by_patient',
        'cancelled_by_professional'
      )
    );
  END IF;
END $$;
