# NeuroFinance — revisão profunda do desktop do psicólogo

**Status:** briefing de produto, ainda sem implementação  
**Escrito em:** 24 de agosto de 2026  
**Repo / branch:** `neuronexai` / `main`  
**Superfície desta fase:** aplicativo profissional desktop, temas claro e escuro  
**Fora desta fase:** portal do paciente, mobile do psicólogo e mobile do portal

Este texto é a revisão. Ele também é o briefing que, mais tarde, o agente de implementação deve seguir. Não é autorização para corrigir código agora. Não é autorização para mexer em portal, mobile, backend ou Supabase Cloud nesta primeira leva. A ordem combinada é: primeiro o desktop do psicólogo, depois backend e nuvem, e só daqui a alguns dias o portal do paciente desktop, e por fim o mobile do psicólogo e o mobile do portal.

A leitura que você precisa ter, antes de qualquer plano, é esta: o financeiro da NeuroNex já existe e já é grande, mas ele não se comporta como um único produto. Ele se comporta como duas casas que compartilham o mesmo corredor. De um lado está a Gestão Financeira, que funciona sem conta bancária e guarda lançamentos, cobranças manuais, recebimentos, convênio, recorrência e planejamento. Do outro lado está o NeuroFinance, a conta digital com Asaas por baixo, Pix, boleto, cartão, saque, extrato, cobrança bancária, contestação, tarifa e saúde da conta. As duas casas falam de dinheiro, paciente, status e origem, mas não usam as mesmas palavras, não mostram as mesmas colunas e não deixam claro o que é cobrança, o que é movimento de conta, o que é reembolso, o que é estorno, o que é contestação e o que é repasse.

Quando a pessoa abre NeuroFinance > Cobranças bancárias e depois abre NeuroFinance > Extrato da conta, ela não encontra o mesmo padrão de informação. Uma tela é tabela com Paciente, Valor, Descrição, Origem, Status, Vencimento e Ações. A outra nem é tabela: é uma lista de cartões agrupados por data, com descrição, uma tag de origem, um método escondido em letra minúscula, o paciente só se existir, o valor e um status com outro vocabulário. Isso confunde. A revisão pede que as duas listas passem a parecer da mesma família, com nomenclatura igual, o mesmo conjunto de campos e um ícone `i` à direita de cada nome de coluna. No clique, esse `i` explica o que aquela coluna significa naquele lugar, em linguagem humana, sem jargão de provedor.

O mesmo problema de vocabulário se espalha. Em cobranças o status pago vira Recebida. No extrato vira Confirmado. Na gestão vira Pago. No convênio vira Recebido. No backend o mesmo fato pode ser `paid`, `received`, `confirmed`, `completed` ou `available`. Reembolso, estorno e chargeback existem em pedaços: a agenda já oferece “preparar reembolso do valor pago”, a gestão fala “use estorno” sem um fluxo visível, a função `asaas-refund` já estorna no provedor, e a tela de Contestações só lista chargebacks de cartão. Repasse também é uma palavra com dois significados. Na conta digital, repasse é o saque do saldo Asaas para a conta ou a chave Pix do psicólogo. Em Gestão > Repasses e Convênio, repasse é o dinheiro que a operadora deveria pagar pela sessão, e a própria tela avisa que registrar a baixa não inicia transferência bancária.

Esta revisão descreve o que cada aba faz hoje, o mapa de estados que as cobranças deveriam exibir, o fluxo de dados entre agenda, paciente, gestão, NeuroFinance, Asaas e Supabase, o que falta para convênio e sistemas de saúde, e como reembolso e repasse deveriam aparecer na interface. O detalhe visual de cada aba está em `docs/NEUROFINANCE_MAPA_ABAS_DESKTOP.md`. O detalhe de estados, dados, saúde, reembolso e interface está em `docs/NEUROFINANCE_FLUXOS_COBRANCA_REPASSE_SAUDE.md`. Os três arquivos se leem juntos. Nenhum deles pede que você comece a implementar nesta conversa.

## Como este briefing deve ser usado depois

Quando for hora de mandar isto para o agente que coda o app, o pedido não é “arrume o financeiro”. O pedido é: leia estes três documentos, leia também `docs/FRONTEND_SURFACES.md`, `docs/NEURONEX_DESIGN_SYSTEM.md`, `docs/QUALITY_BAR.md`, `docs/ARCHITECTURE.md` e `docs/SECURITY.md`, e devolva um plano de implementação em fases. A primeira fase é só frontend desktop do psicólogo, nos dois temas. A segunda fase é backend e Supabase Cloud. As fases seguintes, dias depois, são portal do paciente desktop e, por último, os dois mobiles. O agente não mistura superfície. Desktop não importa tela mobile. Portal não importa o operacional do psicólogo. Asaas continua sendo o provedor financeiro e precisa continuar identificado. NeuroFinance continua sendo a marca de produto, não um banco.

O plano precisa incluir, de forma explícita, a unificação das listas de Cobranças bancárias e Extrato detalhado, o dicionário de colunas, o `i` explicativo, o diagrama de estados visível na interface, o desenho de reembolso e de repasse, e o caminho para convênio e sistemas de saúde sem fingir que TISS, TUSS ou portal de operadora já existem no código, porque hoje não existem.

## O que o código mostra hoje, em uma frase longa

A rota `/financeiro` escolhe desktop ou mobile. No desktop, `DesktopFinanceiro` monta a sidebar e `FinanceiroMainContent` decide se a pessoa está na Gestão, que é livre, ou no NeuroFinance, que pede plano, onboarding e conta Asaas. A Gestão lê sobretudo `financial_entries`. O NeuroFinance lê `nb_payments`, movimentos da conta, saldo, Pix, saques e webhooks Asaas. Há uma ponte: ao criar uma cobrança bancária, o backend tenta criar ou atualizar um lançamento gerencial, e ao sincronizar um pagamento ele tenta espelhar o status. Essa ponte não chega intacta na interface. A pessoa ainda vê duas listas, dois vocabulários e dois jeitos de cancelar, pagar, excluir ou “usar estorno”.

## O problema das colunas, dito do jeito que a interface precisa resolver

Hoje, se a mesma cobrança de R$ 200 da Ana, vencendo dia 10, paga via Pix, nasceu na agenda e já foi confirmada no provedor, a pessoa não consegue ler isso com os mesmos olhos nas duas abas. Em Cobranças bancárias ela vê paciente, valor, descrição com o método escondido embaixo, origem, status Recebida e vencimento. No Extrato ela vê um cartão cuja “coluna” principal é a descrição, a origem vira tag NeuroFinance ou Agenda, o método aparece como Pix em outro tamanho, o paciente só entra se o dado existir, a data é a do movimento e não necessariamente o vencimento, e o status vira Confirmado. Não há cabeçalho. Não há `i`. Não há como aprender o que cada campo significa.

A revisão pede o contrário. As duas superfícies devem usar a mesma nomenclatura, o mesmo padrão de informação e o mesmo gesto de ajuda. Cada coluna ganha um `i` à direita do nome. O clique abre uma introdução curta daquela coluna naquele lugar. O texto muda se a pessoa está em cobrança ou em extrato, porque vencimento não é a mesma coisa que data do movimento, mas a palavra da coluna não pode ser inventada de novo a cada tela.

O dicionário proposto, para as listas desktop, é este. Ele ainda não está no código. Ele é o alvo da fase de interface.

```text
Coluna            O que a pessoa precisa entender
────────────────────────────────────────────────────────────────
Paciente          Quem está vinculado a este dinheiro. Se não houver, dizer “Sem paciente”.
Descrição         O nome humano do item: sessão, pacote, mensalidade, Pix recebido, tarifa.
Origem            De onde nasceu: Agenda, Manual, NeuroFinance, Convênio, Pacote, Recorrência.
Método            Como o dinheiro entra ou sai: Pix, Boleto, Cartão, Dinheiro, Convênio, Transferência, A combinar.
Competência       A data que explica o fato. Em cobrança, é o vencimento. No extrato realizado, é a data em que o dinheiro andou. No extrato futuro, é a previsão.
Status            Em que ponto do ciclo a coisa está, com o mesmo vocabulário em todas as listas.
Valor             O valor de face, sempre em real brasileiro, sempre com o mesmo formato.
Líquido           Só quando houver conta digital: o que efetivamente cabe na conta depois de tarifa, antecipação ou estorno.
Ações             O que dá para fazer agora, sem esconder estorno, reembolso, link, baixa ou detalhe.
```

O `i` de cada coluna não é um tooltip de uma palavra. É uma introdução. Exemplo do tom que a interface deve usar, para a coluna Status em Cobranças bancárias:

```text
Status

Aqui o status diz se esta cobrança ainda pode ser paga, se já venceu, se o dinheiro já entrou, se foi cancelada, se está em estorno ou se o cartão contestou.

Recebida não é a mesma coisa que o saldo já estar disponível para saque. Quando o valor ainda está a caminho da conta, o detalhe da cobrança mostra isso com clareza.
```

E o tom para a mesma coluna no Extrato:

```text
Status

No extrato, o status descreve o movimento da conta, não o boleto em si.

Confirmado quer dizer que o lançamento já aconteceu. Em processamento quer dizer que o banco ainda está terminando. Estornado, reembolsado e contestado aparecem como movimentos próprios, para ninguém achar que o dinheiro ainda está aí.
```

Esses textos devem viver em um único dicionário de interface, reutilizado pelas duas listas, pelos detalhes e, mais tarde, pelo portal. Nesta fase, só o desktop do psicólogo os exibe, nos dois temas, com contraste de leitura, foco de teclado e fechamento por Escape.

## O mapa mental das duas casas

```text
/financeiro
│
├── Gestão Financeira          ← não exige conta Asaas
│   ├── Visão Geral
│   ├── Cobranças Manuais
│   ├── Lançamentos
│   ├── Recebimentos
│   ├── Repasses e Convênio
│   ├── Recorrência
│   └── Planejamento
│
└── NeuroFinance               ← exige plano + onboarding + conta
    ├── Conta e Saldo
    ├── Área Pix
    ├── Extrato da conta
    ├── Cobranças bancárias
    ├── Pagamentos
    ├── Antecipação            ← marcada “Em breve”
    ├── Transferências
    ├── Saques
    ├── Contestações
    ├── NFS-e
    ├── Tarifas
    └── Ajustes / Saúde da conta
```

A Gestão é o caderno do consultório. O NeuroFinance é a conta. Uma cobrança manual pode existir só no caderno. Uma cobrança bancária existe na conta e deveria aparecer no caderno sem a pessoa ter de adivinhar. Um Pix recebido existe na conta e só deveria virar “cobrança de paciente” se nasceu como cobrança. Um repasse de convênio existe no caderno até o dinheiro cair, e só vira movimento de conta quando de fato cair, por Pix, TED ou depósito. Misturar esses três tipos na mesma lista, com nomes diferentes, é o que está acontecendo agora.

## Fases, sem atalho

A fase 1 é o desktop do psicólogo. Ela inclui sidebar, abas, listas, detalhes, modais, estados vazios, claro e escuro, o `i` das colunas, o vocabulário único na interface, e o desenho visível dos fluxos de cobrança, reembolso e repasse. Ela não inventa TISS. Ela não liga API de operadora. Ela não refatora o portal. Ela não “aproveita” componente mobile.

A fase 2 é backend e Supabase Cloud. Ela alinha `financial_entries`, `nb_payments`, movimentos, reversões, webhooks, `asaas-refund`, payout e os status canônicos para a interface da fase 1 não mentir. Ela também é o momento de persistir o dicionário de status, em vez de normalizar a cada hook.

A fase 3, depois, é o portal do paciente desktop: o paciente precisa ver o que deve, o que pagou, o que foi reembolsado e o que é convênio, com as mesmas palavras, sem ver saldo, tarifa, saque ou contestação do psicólogo.

A fase 4 é o mobile do psicólogo e o mobile do portal, cada um na sua superfície, sem copiar o layout desktop.

## O que esta revisão não pede agora

Não pede commit de correção. Não pede unificar tabelas no banco nesta conversa. Não pede esconder a Gestão ou fundir as duas casas numa aba só. Não pede tratar NeuroNex como banco. Não pede copiar a lista mobile. Não pede emitir NFS-e de verdade se o produto ainda marca isso como “Em breve”, a menos que o plano da fase 2 decida o contrário com clareza. Não pede integração TISS nesta fase. Pede que o desktop já deixe o lugar certo para convênio, reembolso e repasse, para a fase de nuvem não nascer atrás de uma interface que não cabe o fluxo.

## Arquivos que o plano posterior deve respeitar

O mapa da sidebar está em `src/pages/desktop/DesktopFinanceiro.tsx`. O roteamento visual está em `src/components/financeiro/FinancialDashboard.tsx` e `src/components/financeiro/FinanceiroMainContent.tsx`. A lista de cobranças, nos dois escopos, está em `src/components/financeiro/ChargesWorkspace.tsx`. O extrato detalhado está em `src/components/financeiro/DetailedStatementPanel.tsx` e `src/components/financeiro/FinancialStatement.tsx`. A gestão está em `src/components/financeiro/management/`. O contrato de cobrança bancária está em `src/hooks/use-charges-page.ts` e nas funções `asaas-create-payment`, `asaas-payment-actions`, `asaas-refund`, `asaas-payout`, `asaas-webhook` e `_shared/financial-management.ts`. Convênio de paciente está em `patient_insurance_agreements` e `patient_financial_settings`. Contestações leem `neurofinance_chargebacks_v`.

Se o plano futuro discordar de algum desses arquivos, ele deve dizer por quê. Se concordar, deve apontar a tela, o estado e a coluna, não “melhorar o financeiro”.
