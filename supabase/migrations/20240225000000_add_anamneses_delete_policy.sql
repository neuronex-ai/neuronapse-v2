-- Add missing DELETE policy for patient_anamneses table
-- This allows authenticated users to delete anamnesis records they own
-- Without this policy, RLS silently blocks DELETE operations

DO $$
BEGIN
    -- Only create the policy if it doesn't already exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'patient_anamneses' 
        AND policyname = 'Users can delete own anamneses'
    ) THEN
        EXECUTE 'CREATE POLICY "Users can delete own anamneses" ON public.patient_anamneses FOR DELETE USING (true)';
    END IF;
END $$;
