/**
 * Serviço de Anonimização de Dados para IA
 * 
 * Este módulo garante que dados sensíveis de pacientes sejam
 * anonimizados antes de serem enviados para modelos de IA externos,
 * protegendo a identidade do paciente de forma proativa.
 */

export interface PatientData {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    cpf?: string;
    address?: string;
    birth_date?: string;
    [key: string]: unknown;
}

export interface AnonymizedData {
    originalData: PatientData;
    anonymizedData: PatientData;
    mappings: Map<string, string>;
}

/**
 * Padrões de regex para identificar dados sensíveis
 */
const SENSITIVE_PATTERNS = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    phone: /\b(?:\+55\s?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}\b/g,
    cpf: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
    date: /\b\d{2}\/\d{2}\/\d{4}\b/g,
    fullName: /\b[A-ZÁÀÂçÉÈÊÍÏÓÔÕÖÚÇÑ][a-záàãéèêíïóôõöúçñ]+(?:\s+[A-ZÁÀÂçÉÈÊÍÏÓÔÕÖÚÇÑ][a-záàãéèêíïóôõöúçñ]+)+\b/g,
};

/**
 * Gera um identificador anônimo consistente
 */
const generateAnonymousId = (original: string, prefix: string): string => {
    // Criar um hash simples mas consistente do valor original
    let hash = 0;
    for (let i = 0; i < original.length; i++) {
        const char = original.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return `${prefix}_${Math.abs(hash).toString(16).slice(0, 6)}`;
};

/**
 * Anonimiza campos específicos de um objeto de paciente
 */
export const anonymizePatientData = (patient: PatientData): AnonymizedData => {
    const mappings = new Map<string, string>();
    const anonymizedData = { ...patient };

    // Anonimizar nome
    if (patient.name) {
        const anonName = generateAnonymousId(patient.name, 'PACIENTE');
        mappings.set(patient.name, anonName);
        anonymizedData.name = anonName;
    }

    // Anonimizar email
    if (patient.email) {
        const anonEmail = `${generateAnonymousId(patient.email, 'email')}@anonimo.local`;
        mappings.set(patient.email, anonEmail);
        anonymizedData.email = anonEmail;
    }

    // Anonimizar telefone
    if (patient.phone) {
        mappings.set(patient.phone, '** **** ****');
        anonymizedData.phone = '** **** ****';
    }

    // Remover CPF completamente
    if (patient.cpf) {
        mappings.set(patient.cpf, '[CPF_REMOVIDO]');
        anonymizedData.cpf = undefined;
    }

    // Anonimizar endereço
    if (patient.address) {
        mappings.set(patient.address, '[ENDEREÇO_ANONIMIZADO]');
        anonymizedData.address = '[ENDEREÇO_ANONIMIZADO]';
    }

    // Generalizar data de nascimento (manter apenas ano)
    if (patient.birth_date) {
        const year = new Date(patient.birth_date).getFullYear();
        const anonDate = `${year}-01-01`;
        mappings.set(patient.birth_date, anonDate);
        anonymizedData.birth_date = anonDate;
    }

    // Remover IDs reais
    if (patient.id) {
        const anonId = generateAnonymousId(patient.id, 'id');
        mappings.set(patient.id, anonId);
        anonymizedData.id = anonId;
    }

    return {
        originalData: patient,
        anonymizedData,
        mappings,
    };
};

/**
 * Anonimiza texto livre (notas de sessão, prontuário, etc.)
 * Substitui padrões sensíveis por placeholders
 */
export const anonymizeText = (text: string, patientName?: string): {
    anonymizedText: string;
    mappings: Map<string, string>;
} => {
    const mappings = new Map<string, string>();
    let anonymizedText = text;

    // Se tiver o nome do paciente, substituir primeiro
    if (patientName) {
        const anonName = generateAnonymousId(patientName, 'PACIENTE');
        mappings.set(patientName, anonName);
        anonymizedText = anonymizedText.replace(new RegExp(patientName, 'gi'), anonName);
    }

    // Substituir emails
    anonymizedText = anonymizedText.replace(SENSITIVE_PATTERNS.email, (match) => {
        const replacement = `[EMAIL_${generateAnonymousId(match, 'e').slice(-4)}]`;
        mappings.set(match, replacement);
        return replacement;
    });

    // Substituir telefones
    anonymizedText = anonymizedText.replace(SENSITIVE_PATTERNS.phone, (match) => {
        const replacement = '[TELEFONE]';
        mappings.set(match, replacement);
        return replacement;
    });

    // Substituir CPFs
    anonymizedText = anonymizedText.replace(SENSITIVE_PATTERNS.cpf, (match) => {
        const replacement = '[CPF]';
        mappings.set(match, replacement);
        return replacement;
    });

    return { anonymizedText, mappings };
};

/**
 * Reverte a anonimização em um texto de resposta da IA
 */
export const deanonymizeText = (text: string, mappings: Map<string, string>): string => {
    let result = text;

    // Inverter o mapeamento (anônimo -> original)
    const reverseMap = new Map<string, string>();
    mappings.forEach((anon, original) => {
        reverseMap.set(anon, original);
    });

    // Substituir de volta
    reverseMap.forEach((original, anon) => {
        result = result.replace(new RegExp(anon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), original);
    });

    return result;
};

/**
 * Prepara contexto de IA com dados anonimizados
 * Útil para construir prompts seguros
 */
export const prepareAnonymizedContext = (
    sessionNotes: string[],
    patientName?: string
): {
    anonymizedNotes: string[];
    combinedMappings: Map<string, string>;
} => {
    const combinedMappings = new Map<string, string>();

    const anonymizedNotes = sessionNotes.map((note) => {
        const { anonymizedText, mappings } = anonymizeText(note, patientName);
        mappings.forEach((v, k) => combinedMappings.set(k, v));
        return anonymizedText;
    });

    return { anonymizedNotes, combinedMappings };
};

/**
 * Verifica se um texto contém dados potencialmente sensíveis
 */
export const containsSensitiveData = (text: string): boolean => {
    return (
        SENSITIVE_PATTERNS.email.test(text) ||
        SENSITIVE_PATTERNS.phone.test(text) ||
        SENSITIVE_PATTERNS.cpf.test(text)
    );
};

export default {
    anonymizePatientData,
    anonymizeText,
    deanonymizeText,
    prepareAnonymizedContext,
    containsSensitiveData,
};
