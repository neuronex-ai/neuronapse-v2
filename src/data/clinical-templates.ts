import { BrainCircuit, ClipboardList, FileText, ShieldCheck, User, Waves } from 'lucide-react';

export interface Template {
    id: string;
    title: string;
    description: string;
    content: string;
    category: 'clinico' | 'tcc' | 'psicanalise' | 'documentos';
    icon: any;
}

export const TEMPLATES: Template[] = [
    // === CLÍNICO GERAL ===
    {
        id: 'soap',
        title: 'Evolução SOAP',
        description: 'Padrão ouro para registro diário: Subjetivo, Objetivo, Avaliação e Plano.',
        category: 'clinico',
        icon: ClipboardList,
        content: `<h3>1. Subjetivo (S)</h3>
<p><strong>Queixa Principal:</strong> Relatou sensação de...</p>
<p><strong>Humor Relatado:</strong> Ansioso / Deprimido / Eutímico</p>
<p><strong>Eventos Recentes:</strong> Descreveu conflito familiar...</p>

<h3>2. Objetivo (O)</h3>
<p><strong>Aparência:</strong> Cuidada / Desleixada</p>
<p><strong>Comportamento:</strong> Agitado / Letárgico / Cooperativo</p>
<p><strong>Discurso:</strong> Coerente / Acelerado / Monossilábico</p>

<h3>3. Avaliação (A)</h3>
<p><strong>Impressão Clínica:</strong> Paciente apresenta sinais de...</p>
<p><strong>Evolução:</strong> Melhora/Piora em relação à sessão anterior.</p>
<p><strong>Risco:</strong> Baixo / Médio / Alto (Ideação suicida: Negada)</p>

<h3>4. Plano (P)</h3>
<p><strong>Intervenção:</strong> Psicoeducação sobre...</p>
<p><strong>Tarefa de Casa:</strong> Registro de pensamentos.</p>
<p><strong>Próxima Sessão:</strong> Focar em estratégias de enfrentamento.</p>`
    },
    {
        id: 'anamnese-adulta',
        title: 'Anamnese Completa (Adulto)',
        description: 'Roteiro detalhado para primeira consulta e levantamento de história de vida.',
        category: 'clinico',
        icon: User,
        content: `<h2>ANAMNESE PSICOLÓGICA</h2>
<hr/>
<h3>1. Identificação</h3>
<p><strong>Nome:</strong> ___________________________________ | <strong>Idade:</strong> _____</p>
<p><strong>Estado Civil:</strong> _____________ | <strong>Profissão:</strong> _____________</p>
<p><strong>Escolaridade:</strong> _____________ | <strong>Religião:</strong> _____________</p>

<h3>2. Queixa Principal</h3>
<blockquote>"O que o traz aqui hoje?"</blockquote>
<p></p>

<h3>3. História da Moléstia Atual (HMA)</h3>
<p>Quando iniciou? Como evoluiu? Fatores de melhora/piora?</p>

<h3>4. Histórico Familiar</h3>
<p>Configuração familiar, doenças psiquiátricas na família, dinmica relacional:</p>

<h3>5. Histórico de Desenvolvimento</h3>
<p>Infncia, adolescência, marcos do desenvolvimento, traumas:</p>

<h3>6. Vida Social e Afetiva</h3>
<p>Relacionamentos, redes de apoio, lazer:</p>

<h3>7. Histórico Médico e Medicamentoso</h3>
<p>Doenças preexistentes, medicações em uso, sono, alimentação:</p>

<h3>8. Exame do Estado Mental (Súmula)</h3>
<table style="width:100%; border-collapse:collapse; font-size:14px;">
<tr><td style="padding:8px; border:1px solid #333;"><strong>Aparência:</strong></td><td style="padding:8px; border:1px solid #333;">Adequada / Desleixada / Exêntrica</td></tr>
<tr><td style="padding:8px; border:1px solid #333;"><strong>Atitude:</strong></td><td style="padding:8px; border:1px solid #333;">Colaborativa / Hostil / Sedutora / Indiferente</td></tr>
<tr><td style="padding:8px; border:1px solid #333;"><strong>Consciência:</strong></td><td style="padding:8px; border:1px solid #333;">Vigil / Obnubilada / Torpor / Coma</td></tr>
<tr><td style="padding:8px; border:1px solid #333;"><strong>Atenção:</strong></td><td style="padding:8px; border:1px solid #333;">Normovigil / Hipovigil / Hipervigil</td></tr>
<tr><td style="padding:8px; border:1px solid #333;"><strong>Memória:</strong></td><td style="padding:8px; border:1px solid #333;">Preservada / Déficit (Recente/Remota)</td></tr>
<tr><td style="padding:8px; border:1px solid #333;"><strong>Afeto:</strong></td><td style="padding:8px; border:1px solid #333;">Modulado / Embotado / Lábil / Incongruente</td></tr>
<tr><td style="padding:8px; border:1px solid #333;"><strong>Humor:</strong></td><td style="padding:8px; border:1px solid #333;">Eutímico / Deprimido / Elevado / Irritável</td></tr>
<tr><td style="padding:8px; border:1px solid #333;"><strong>Pensamento:</strong></td><td style="padding:8px; border:1px solid #333;">Lógico / Mágico / Desorganizado / Delirante</td></tr>
<tr><td style="padding:8px; border:1px solid #333;"><strong>Juízo Crítico:</strong></td><td style="padding:8px; border:1px solid #333;">Preservado / Prejudicado</td></tr>
</table>`
    },
    {
        id: 'sessao-padrao',
        title: 'Registro de Sessão Padrão',
        description: 'Estrutura simples para anotações livres com tópicos essenciais.',
        category: 'clinico',
        icon: FileText,
        content: `<h3>Sessão nº ____</h3>
<p><strong>Data:</strong> ___/___/___ | <strong>Hora:</strong> __:__</p>

<h4>Relato do Paciente:</h4>
<p>Tópicos abordados, acontecimentos da semana:</p>
<ul><li></li><li></li></ul>

<h4>Observações Clínicas:</h4>
<p>Estado emocional, comportamento na sessão, insights:</p>

<h4>Intervenções Realizadas:</h4>
<ul><li></li></ul>

<h4>Tarefas/Homework:</h4>
<ul><li></li></ul>

<h4>Próximos Passos:</h4>
<p></p>`
    },
    {
        id: 'alta-terapeutica',
        title: 'Alta Terapêutica',
        description: 'Documento formal de encerramento do processo terapêutico.',
        category: 'clinico',
        icon: FileText,
        content: `<h2>RELATÓRIO DE ALTA TERAPÊUTICA</h2>
<p><strong>Paciente:</strong> ___________________________________</p>
<p><strong>Período do Tratamento:</strong> De ___/___/___ a ___/___/___</p>
<p><strong>Número de Sessões:</strong> _____</p>

<h3>1. Motivo da Alta</h3>
<p>( ) Atingimento dos objetivos terapêuticos</p>
<p>( ) Desistência / Abandono</p>
<p>( ) Encaminhamento externo</p>

<h3>2. Resumo da Evolução</h3>
<p>Descrição sucinta dos progressos alcançados em relação à queixa inicial:</p>

<h3>3. Conduta / Orientações</h3>
<p>Recomendações finais para manutenção do bem-estar:</p>

<br/><br/>
<p style="text-align:center">___________________________________<br/>Assinatura do Psicólogo(a)<br/>CRP __/____</p>`
    },
    {
        id: 'contrato-terapeutico',
        title: 'Contrato Terapêutico',
        description: 'Termo de compromisso e regras do setting terapêutico.',
        category: 'clinico',
        icon: FileText,
        content: `<h2>CONTRATO TERAPÊUTICO</h2>
<hr/>

<h3>1. Das Partes</h3>
<p>O presente termo estabelece as condições do acompanhamento psicológico entre o(a) paciente _________________ e o(a) psicólogo(a) _________________, CRP _________.</p>

<h3>2. Dos Honorários</h3>
<p>Valor da sessão: R$ _______<br/>
Forma de pagamento: ( ) Semanal ( ) Quinzenal ( ) Mensal<br/>
Reajuste anual: ( ) Sim ( ) Não</p>

<h3>3. Do Sigilo Profissional</h3>
<p>Garantido conforme Código de Ética Profissional do Psicólogo, exceto em casos de risco à vida (própria ou terceiros) ou ordem judicial.</p>

<h3>4. Faltas e Desmarcações</h3>
<p>Desmarcações devem ocorrer com antecedência mínima de 24h. Faltas não justificadas serão cobradas integralmente.</p>

<h3>5. Duração e Frequência</h3>
<p>Sessões de 50 minutos, com frequência _______________.</p>

<br/><br/>
<p style="text-align:center">________________________ &nbsp;&nbsp;&nbsp; ________________________<br/>Paciente &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Psicólogo(a)</p>`
    },
    {
        id: 'plano-tratamento',
        title: 'Plano de Tratamento',
        description: 'Planejamento de objetivos de curto, médio e longo prazo.',
        category: 'clinico',
        icon: ClipboardList,
        content: `<h2>📋 Plano de Tratamento Individual (PTI)</h2>
<p><strong>Paciente:</strong> _______________________<br/>
<strong>Data de Início:</strong> ___/___/______<br/>
<strong>Revisão Prevista:</strong> ___/___/______</p>
<hr/>

<h3>1. Diagnóstico / Hipótese Diagnóstica</h3>
<p></p>

<h3>2. Objetivos do Tratamento</h3>
<table style="width:100%; border-collapse:collapse;">
<tr><td style="padding:10px; border:1px solid #555;"><strong>Curto Prazo (1-3 meses)</strong><br/>- Redução de sintomas agudos<br/>- Estabelecimento de vínculo</td></tr>
<tr><td style="padding:10px; border:1px solid #555;"><strong>Médio Prazo (3-6 meses)</strong><br/>- Mudança de padrões comportamentais<br/>- Aquisição de novas habilidades</td></tr>
<tr><td style="padding:10px; border:1px solid #555;"><strong>Longo Prazo (> 6 meses)</strong><br/>- Consolidação da autonomia<br/>- Prevenção de recaídas</td></tr>
</table>

<h3>3. Estratégias / Abordagens</h3>
<p>Técnicas que serão utilizadas (ex: Reestruturação Cognitiva, Dessensibilização, Associação Livre):</p>
<ul><li></li></ul>`
    },

    // === TCC ===
    {
        id: 'rpd',
        title: 'Registro de Pensamentos (RPD)',
        description: 'Tabela clássica da TCC para monitoramento cognitivo.',
        category: 'tcc',
        icon: BrainCircuit,
        content: `<h3>🧠 Registro de Pensamentos Automáticos</h3>
<table style="width:100%; border-collapse:collapse; font-size:14px;">
<tr style="background:#1a1a2e;">
<th style="padding:10px; border:1px solid #444; width:15%;">Situação</th>
<th style="padding:10px; border:1px solid #444; width:20%;">Pensamento Automático</th>
<th style="padding:10px; border:1px solid #444; width:10%;">Emoção (0-100)</th>
<th style="padding:10px; border:1px solid #444; width:25%;">Resposta Racional</th>
<th style="padding:10px; border:1px solid #444; width:10%;">Resultado</th>
</tr>
<tr>
<td style="padding:10px; border:1px solid #444;">O que aconteceu? Onde? Quando?</td>
<td style="padding:10px; border:1px solid #444;">O que passou pela sua cabeça?</td>
<td style="padding:10px; border:1px solid #444;">Tristeza (80%)<br/>Ansiedade (90%)</td>
<td style="padding:10px; border:1px solid #444;">Qual a evidência contrária? O que diria a um amigo?</td>
<td style="padding:10px; border:1px solid #444;">Reavaliação da emoção</td>
</tr>
<tr><td colspan="5" style="border:1px solid #444; height:100px;"></td></tr>
</table>`
    },
    {
        id: 'reestruturacao',
        title: 'Reestruturação Cognitiva',
        description: 'Ficha para desafio de crenças centrais e distorções.',
        category: 'tcc',
        icon: BrainCircuit,
        content: `<h3>🔄 Reestruturação Cognitiva</h3>
<h4>1. Crença Central Identificada</h4>
<blockquote style="border-left:3px solid #a78bfa; padding-left:12px; color:#ccc;">"Eu sou incompetente"</blockquote>

<h4>2. Tipo de Distorção Cognitiva</h4>
<p>☐ Catastrofização ☐ Leitura mental ☐ Rotulação ☐ Pensamento dicotômico<br/>
☐ Abstração seletiva ☐ Personalização ☐ Deveria/Tenho que ☐ Outro: ___</p>

<h4>3. Origem da Crença</h4>
<p>Histórico e experiências que formaram essa visão:</p>

<h4>4. Desafio Socrático (Evidências)</h4>
<table style="width:100%; border-collapse:collapse;">
<tr>
<td style="padding:10px; border:1px solid #444; width:50%; color:#ef4444;"><strong>Evidências que APOIAM a crença</strong></td>
<td style="padding:10px; border:1px solid #444; width:50%; color:#10b981;"><strong>Evidências que CONTRADIZEM a crença</strong></td>
</tr>
<tr><td style="height:100px; border:1px solid #444; vertical-align:top;"></td><td style="height:100px; border:1px solid #444; vertical-align:top;"></td></tr>
</table>

<h4>5. Nova Crença Funcional</h4>
<p>Como reformular essa crença de forma mais realista?</p>`
    },
    {
        id: 'modelo-abc',
        title: 'Modelo ABC (Ellis)',
        description: 'Para trabalhar crenças irracionais na REBT.',
        category: 'tcc',
        icon: BrainCircuit,
        content: `<h3>Modelo ABC (REBT)</h3>
<table style="width:100%; border-collapse:collapse;">
<tr><td style="padding:12px; border:1px solid #444; background:#2a1a4a;"><strong>A - Evento Ativador (Activating Event)</strong></td>
<td style="padding:12px; border:1px solid #444;">O que aconteceu de fato?</td></tr>

<tr><td style="padding:12px; border:1px solid #444; background:#2a1a4a;"><strong>B - Crença (Belief)</strong></td>
<td style="padding:12px; border:1px solid #444;">O que você pensou/disse a si mesmo?</td></tr>

<tr><td style="padding:12px; border:1px solid #444; background:#2a1a4a;"><strong>C - Consequência (Consequence)</strong></td>
<td style="padding:12px; border:1px solid #444;">O que você sentiu e como agiu?</td></tr>

<tr><td style="padding:12px; border:1px solid #444; background:#2a1a4a;"><strong>D - Disputa (Dispute)</strong></td>
<td style="padding:12px; border:1px solid #444;">Como desafiar essa crença? Ela é lógica? Útil?</td></tr>

<tr><td style="padding:12px; border:1px solid #444; background:#2a1a4a;"><strong>E - Efeito (New Effect)</strong></td>
<td style="padding:12px; border:1px solid #444;">Novo comportamento/emoção desejados.</td></tr>
</table>`
    },

    // === PSICANÁLISE ===
    {
        id: 'analise-sonhos',
        title: 'Registro de Sonhos',
        description: 'Estrutura para relato e associação livre de material onírico.',
        category: 'psicanalise',
        icon: Waves,
        content: `<h3>🌙 Registro de Material Onírico</h3>

<h4>1. Conteúdo Manifesto (Relato do Sonho)</h4>
<p>Descrição literal do que foi sonhado, sem interpretações:</p>

<h4>2. Restos Diurnos</h4>
<p>Acontecimentos do dia anterior que podem ter influenciado:</p>

<h4>3. Associações Livres</h4>
<p>Palavras, memórias ou sentimentos que surgem ao pensar nos elementos do sonho:</p>
<ul>
<li>Elemento A: _________________</li>
<li>Elemento B: _________________</li>
</ul>

<h4>4. Afetos Predominantes</h4>
<p>Sentimentos durante o sonho e ao acordar:</p>

<h4>5. Hipóteses Interpretativas (Conteúdo Latente)</h4>
<p>Desejos inconscientes, resistências ou conflitos representados:</p>`
    },
    {
        id: 'processo-transferencial',
        title: 'Análise Transferencial',
        description: 'Mapeamento da relação terapêutica e contratransferência.',
        category: 'psicanalise',
        icon: Waves,
        content: `<h3>🔄 Dinmica Transferencial</h3>

<h4>1. Transferência (Paciente -> Analista)</h4>
<p>Como o paciente se dirige ao analista hoje? (Lugar de saber, objeto de amor/ódio, figura paterna/materna):</p>

<h4>2. Contratransferência (Analista -> Paciente)</h4>
<p>Sentimentos despertados no analista (raiva, tédio, excesso de cuidado, angústia):</p>

<h4>3. Atuações (Acting-out)</h4>
<p>Ações fora da sessão ou atrasos/faltas significativos:</p>

<h4>4. Manejo Clínico</h4>
<p>Intervenções realizadas visando a perlaboração:</p>`
    },

    // === OUTROS DOCUMENTOS ===
    {
        id: 'atestado',
        title: 'Atestado Psicológico',
        description: 'Atestado padrão para justificativa de afastamento.',
        category: 'documentos',
        icon: ShieldCheck,
        content: `<div style="text-align:center; margin-bottom:20px;">
<h3>ATESTADO PSICOLÓGICO</h3>
</div>
<p>Atesto, para os devidos fins, que o(a) Sr(a). <strong>[NOME DO PACIENTE]</strong> encontra-se sob meus cuidados profissionais, tendo comparecido a atendimento nesta data das __:__ às __:__ horas.</p>

<p>Por motivos de ordem psicológica (CID-10/11 opcional: ________), necessita de afastamento de suas atividades laborais/escolares por ____ (______) dias, a contar desta data.</p>

<br/><br/>
<p style="text-align:right">
[CIDADE], [DATA]<br/><br/>
___________________________________<br/>
<strong>[SEU NOME]</strong><br/>
Psicólogo(a) - CRP __/____
</p>`
    },
    {
        id: 'declaracao',
        title: 'Declaração de Comparecimento',
        description: 'Documento simples para comprovar presença.',
        category: 'documentos',
        icon: FileText,
        content: `<div style="text-align:center; margin-bottom:20px;">
<h3>DECLARAÇáO DE COMPARECIMENTO</h3>
</div>
<p>Declaro, para os devidos fins, que o(a) Sr(a). <strong>[NOME DO PACIENTE]</strong> compareceu a atendimento psicológico sob meus cuidados profissionais no dia de hoje, no horário das __:__ às __:__ horas.</p>

<br/><br/>
<p style="text-align:right">
[CIDADE], [DATA]<br/><br/>
___________________________________<br/>
<strong>[SEU NOME]</strong><br/>
Psicólogo(a) - CRP __/____
</p>`
    }
];
