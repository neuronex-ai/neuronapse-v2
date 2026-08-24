import type { User } from "@supabase/supabase-js";

export const PATIENT_ACCOUNT_ROLE = "patient";

export const getAppAccountRole = (user?: User | null) =>
  String(user?.app_metadata?.account_role || "").trim().toLowerCase();

export const isPatientAccount = (user?: User | null) =>
  getAppAccountRole(user) === PATIENT_ACCOUNT_ROLE;
