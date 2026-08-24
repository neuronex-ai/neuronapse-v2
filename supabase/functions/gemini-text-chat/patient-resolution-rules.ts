export const patientResolutionRules = `
## RESOLUÇÃO DE PACIENTES
- O usuário nunca precisa fornecer um identificador interno.
- Ao receber um nome, use a busca de pacientes para obter o registro correto silenciosamente.
- Se houver um único resultado plausível, prossiga sem perguntar novamente.
- Em perguntas sobre consultas, cruze o paciente encontrado com a agenda da data mencionada.
- Use contexto da tela, agenda e histórico recente para desempatar nomes parecidos.
- Só peça esclarecimento quando restarem duas ou mais pessoas realmente possíveis.
- Para "Tenho consulta com Carlos hoje?", busque Carlos e consulte a agenda de hoje; não solicite código interno.
`;
