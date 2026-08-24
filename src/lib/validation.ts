import * as z from "zod";

const optionalText = (max?: number) => {
  const schema = max ? z.string().max(max, `Máximo de ${max} caracteres.`) : z.string();
  return schema.optional().or(z.literal(""));
};

export const PatientGroupSchema = z.enum(["adult", "child", "adolescent", "elderly"]);
export const PatientGenderSchema = z.enum([
  "male",
  "female",
  "agender",
  "gender_fluid",
  "non_binary",
  "transgender",
  "prefer_not_to_say",
  "other",
]);
export const PatientFinancialPlanSchema = z.enum(["per_session", "monthly", "insurance", "exempt"]);

export const NewPatientSchema = z.object({
  quick_registration: z.boolean().default(true),
  name: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }).max(100, "Máximo de 100 caracteres."),
  group_type: PatientGroupSchema.default("adult"),
  email: z.string().email({ message: "Email inválido." }).max(100, "Máximo de 100 caracteres.").optional().or(z.literal("")),
  phone_country_code: z.string().default("+55"),
  mobile_phone: optionalText(40),
  phone: optionalText(40),
  landline_phone: optionalText(40),
  cpf: optionalText(100),
  rg: optionalText(100),
  birth_date: z.date().optional(),
  gender_identity: PatientGenderSchema.default("male"),
  has_social_name: z.boolean().default(false),
  social_name: optionalText(100),
  notes: optionalText(10000),

  professional_name: optionalText(120),
  financial_plan: PatientFinancialPlanSchema.default("per_session"),
  session_value: optionalText(32),
  monthly_value: optionalText(32),
  billing_day: optionalText(2),
  insurance_agreement_id: optionalText(64),
  insurance_session_value: optionalText(32),
  insurance_card_number: optionalText(80),
  insurance_card_expires_at: z.date().optional(),

  country: z.string().default("Brasil"),
  postal_code: optionalText(20),
  city: optionalText(120),
  state: optionalText(2),
  street: optionalText(160),
  street_number: optionalText(40),
  neighborhood: optionalText(120),
  complement: optionalText(160),
  address: optionalText(300),

  naturality: optionalText(120),
  education_level: optionalText(80),
  race: optionalText(40),
  profession: optionalText(120),
  relative_name: optionalText(120),
  relative_relationship: optionalText(50),
  relative_phone: optionalText(40),
  referrer_option_id: optionalText(64),

  responsible_name: optionalText(120),
  responsible_email: z.string().email({ message: "Email inválido." }).optional().or(z.literal("")),
  responsible_phone_country_code: z.string().default("+55"),
  responsible_mobile_phone: optionalText(40),
  responsible_cpf: optionalText(40),
  responsible_rg: optionalText(40),
  responsible_birth_date: z.date().optional(),
  responsible_use_for_billing_documents: z.boolean().default(false),

  diagnosis: optionalText(),
  emergency_name: optionalText(),
  emergency_phone: optionalText(),
  payer_type: z.enum(["patient", "other"]).default("patient"),
  payer_name: optionalText(),
  payer_cpf: optionalText(),
  medications: z.array(z.object({
    name: z.string().min(1, "Nome necessário"),
    dosage: optionalText(),
    frequency: optionalText(),
  })).optional().default([]),
}).superRefine((data, ctx) => {
  if (data.quick_registration && (data.notes || "").length > 400) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "No cadastro rápido, observações têm limite de 400 caracteres.",
      path: ["notes"],
    });
  }

  if (data.has_social_name && !data.social_name?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe o nome social.",
      path: ["social_name"],
    });
  }

  if (data.financial_plan === "monthly" && !data.monthly_value?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe o valor da mensalidade.",
      path: ["monthly_value"],
    });
  }

  if (data.financial_plan === "insurance") {
    if (!data.insurance_agreement_id || data.insurance_agreement_id === "__none") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione um convênio.",
        path: ["insurance_agreement_id"],
      });
    }
    if (!data.insurance_session_value?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o valor da sessão sem convênio.",
        path: ["insurance_session_value"],
      });
    }
  }

  if (data.payer_type === "other") {
    if (!data.payer_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Nome do responsável é obrigatório.",
        path: ["payer_name"],
      });
    }
    if (!data.payer_cpf) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CPF do responsável é obrigatório.",
        path: ["payer_cpf"],
      });
    }
  }
});

export type NewPatientFormValues = z.infer<typeof NewPatientSchema>;

const BaseAppointmentSchema = z.object({
  patient_id: z.string().uuid({ message: "Selecione um paciente válido." }),
  date: z.date({ required_error: "A data da consulta é obrigatória." }),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, { message: "Formato de hora inválido (HH:mm)." }),
  duration: z.string().min(1, { message: "Duração é obrigatória." }),
  type: z.enum(["presencial", "online"], { required_error: "O tipo é obrigatório." }),
  notes: z.string().optional(),
  location: z.string().optional().or(z.literal("")),
});

export const NewAppointmentSchema = BaseAppointmentSchema.superRefine((data, ctx) => {
  if (data.type === "presencial" && !data.location) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "O endereço é obrigatório para consultas presenciais.",
      path: ["location"],
    });
  }
});

export type NewAppointmentFormValues = z.infer<typeof NewAppointmentSchema>;

export const NewRecurringAppointmentSchema = BaseAppointmentSchema.extend({
  repetition: z.enum(["weekly", "biweekly", "monthly"], { required_error: "A repetição é obrigatória." }),
  endDate: z.date({ required_error: "A data final da recorrência é obrigatória." }),
}).superRefine((data, ctx) => {
  if (data.type === "presencial" && !data.location) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "O endereço é obrigatório para consultas presenciais.",
      path: ["location"],
    });
  }
  if (data.endDate <= data.date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A data final deve ser posterior ou igual à data inicial.",
      path: ["endDate"],
    });
  }
});

export type NewRecurringAppointmentFormValues = z.infer<typeof NewRecurringAppointmentSchema>;

export const NewTransactionSchema = z.object({
  description: z.string().min(3, { message: "A descrição deve ter pelo menos 3 caracteres." }),
  amount: z.coerce.number().positive({ message: "O valor deve ser positivo." }),
  type: z.enum(["income", "expense"], { required_error: "O tipo é obrigatório." }),
  category: z.string().optional(),
  date: z.coerce.date({ required_error: "A data é obrigatória." }),
  payment_method: z.enum(["pix", "money", "credit_card", "debit_card", "boleto", "mixed"]).default("pix").optional(),
  installments: z.coerce.number().min(1).default(1).optional(),
  external_reference: z.string().optional(),
  patient_id: z.string().optional(),
  package_id: z.string().optional(),
  create_new_package: z.boolean().optional(),
  new_package_sessions: z.coerce.number().optional(),
  debit_session: z.boolean().optional().default(true),
});

export type NewTransactionFormValues = z.infer<typeof NewTransactionSchema>;

export const LoginFormSchema = z.object({
  email: z.string().email({ message: "Email inválido." }),
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres." }),
  rememberMe: z.boolean().default(false).optional(),
});

export type LoginFormValues = z.infer<typeof LoginFormSchema>;

export const SignupFormSchema = z.object({
  email: z.string().email({ message: "Email inválido." }),
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres." }),
  firstName: z.string().min(2, { message: "O primeiro nome é obrigatório." }),
  lastName: z.string().min(2, { message: "O sobrenome é obrigatório." }),
});

export type SignupFormValues = z.infer<typeof SignupFormSchema>;
