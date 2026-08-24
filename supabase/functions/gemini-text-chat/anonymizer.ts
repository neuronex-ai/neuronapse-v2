/**
 * Módulo de Anonimização de Dados Sensíveis para IA
 * 
 * Este módulo protege a identidade dos pacientes ao enviar
 * dados para modelos de IA externos (Gemini).
 */

// Padrões de regex para identificar dados sensíveis
const SENSITIVE_PATTERNS = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    phone: /\b(?:\+55\s?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}\b/g,
    cpf: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
};

/**
 * Gera um ID anônimo consistente baseado no valor original
 * (mesmo input sempre gera mesmo output dentro da sessão)
 */
function generateAnonymousId(original: string, prefix: string): string {
    let hash = 0;
    for (let i = 0; i < original.length; i++) {
        const char = original.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `${prefix}_${Math.abs(hash).toString(16).slice(0, 6).toUpperCase()}`;
}

/**
 * Anonimiza dados de paciente em um objeto
 */
export function anonymizePatient(patient: any): { anonymized: any; mappings: Record<string, string> } {
    if (!patient) return { anonymized: patient, mappings: {} };

    const mappings: Record<string, string> = {};
    const anonymized = { ...patient };

    // Anonimizar nome (manter apenas iniciais)
    if (patient.name) {
        const anonName = generateAnonymousId(patient.name, 'PACIENTE');
        mappings[patient.name] = anonName;
        anonymized.name = anonName;
    }

    // Remover email
    if (patient.email) {
        mappings[patient.email] = '[EMAIL_PROTEGIDO]';
        anonymized.email = '[EMAIL_PROTEGIDO]';
    }

    // Remover telefone
    if (patient.phone) {
        mappings[patient.phone] = '[TELEFONE_PROTEGIDO]';
        anonymized.phone = '[TELEFONE_PROTEGIDO]';
    }

    // Remover CPF completamente
    if (patient.cpf) {
        mappings[patient.cpf] = '[CPF_REMOVIDO]';
        delete anonymized.cpf;
    }

    // Remover endereço
    if (patient.address) {
        mappings[patient.address] = '[ENDEREÇO_REMOVIDO]';
        anonymized.address = '[CIDADE_ANONIMIZADA]';
    }

    // Generalizar data de nascimento (apenas ano)
    if (patient.birth_date) {
        try {
            const year = new Date(patient.birth_date).getFullYear();
            anonymized.birth_date = `Nascido em ${year}`;
        } catch {
            anonymized.birth_date = '[DATA_PROTEGIDA]';
        }
    }

    // Manter apenas ID se necessário para referência
    if (patient.id) {
        const anonId = generateAnonymousId(patient.id, 'ID');
        mappings[patient.id] = anonId;
        // Mantém o ID real para uso interno, mas o mapeia
    }

    return { anonymized, mappings };
}

/**
 * Anonimiza texto livre (notas de sessão, mensagens, etc.)
 */
export function anonymizeText(text: string, patientName?: string): { anonymized: string; mappings: Record<string, string> } {
    if (!text) return { anonymized: text, mappings: {} };

    const mappings: Record<string, string> = {};
    let anonymized = text;

    // Substituir nome do paciente se fornecido
    if (patientName) {
        const anonName = generateAnonymousId(patientName, 'PACIENTE');
        mappings[patientName] = anonName;
        anonymized = anonymized.replace(new RegExp(patientName, 'gi'), anonName);
    }

    // Substituir emails
    anonymized = anonymized.replace(SENSITIVE_PATTERNS.email, (match) => {
        const replacement = '[EMAIL]';
        mappings[match] = replacement;
        return replacement;
    });

    // Substituir telefones
    anonymized = anonymized.replace(SENSITIVE_PATTERNS.phone, (match) => {
        const replacement = '[TELEFONE]';
        mappings[match] = replacement;
        return replacement;
    });

    // Substituir CPFs
    anonymized = anonymized.replace(SENSITIVE_PATTERNS.cpf, (match) => {
        const replacement = '[CPF]';
        mappings[match] = replacement;
        return replacement;
    });

    return { anonymized, mappings };
}

/**
 * Anonimiza contexto completo antes de enviar para IA
 */
export function anonymizeContextForAI(context: any, currentMappings: Record<string, string> = {}): {
    anonymizedContext: any;
    allMappings: Record<string, string>;
} {
    const allMappings = { ...currentMappings };

    if (!context) return { anonymizedContext: context, allMappings };

    const anonymizedContext = { ...context };

    // Anonimizar paciente ativo
    if (context.activePatient) {
        const { anonymized, mappings } = anonymizePatient(context.activePatient);
        anonymizedContext.activePatient = anonymized;
        Object.assign(allMappings, mappings);
    }

    // Anonimizar notas de sessão
    if (context.sessionNotes && Array.isArray(context.sessionNotes)) {
        const patientName = context.activePatient?.name;
        anonymizedContext.sessionNotes = context.sessionNotes.map((note: any) => {
            if (typeof note === 'string') {
                const { anonymized } = anonymizeText(note, patientName);
                return anonymized;
            }
            if (note.content) {
                const { anonymized, mappings } = anonymizeText(note.content, patientName);
                Object.assign(allMappings, mappings);
                return { ...note, content: anonymized };
            }
            return note;
        });
    }

    return { anonymizedContext, allMappings };
}

/**
 * Reverte a anonimização em uma resposta da IA
 */
export function deanonymizeResponse(response: string, mappings: Record<string, string>): string {
    if (!response || !mappings || Object.keys(mappings).length === 0) return response;

    let result = response;

    // Inverter mapeamento (anônimo -> original)
    const reverseMap: Record<string, string> = {};
    for (const [original, anon] of Object.entries(mappings)) {
        reverseMap[anon] = original;
    }

    // Substituir de volta
    for (const [anon, original] of Object.entries(reverseMap)) {
        const escaped = anon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(new RegExp(escaped, 'g'), original);
    }

    return result;
}
