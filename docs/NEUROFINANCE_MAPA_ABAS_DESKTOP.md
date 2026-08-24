# Mapa de funcionalidades — desktop do psicólogo

**Companheiro de:** `docs/NEUROFINANCE_REVISAO_PROFUNDA.md`  
**Escopo:** só o que a pessoa vê em `/financeiro` no desktop, temas claro e escuro  
**Leitura:** cada bloco é uma aba. Primeiro o que existe. Depois o que a pessoa consegue fazer. Depois o que a revisão pede para a interface, sem implementar agora.

Este mapa é o formato visual pedido: uma árvore por grupo, depois uma ficha por aba. A nomenclatura das listas, o `i` das colunas, os estados de cobrança e os fluxos de reembolso, repasse e saúde estão detalhados no terceiro arquivo.

```text
FINANCEIRO DESKTOP
│
├─ GESTÃO FINANCEIRA
│  ├─ Visão Geral
│  ├─ Cobranças Manuais
│  ├─ Lançamentos
│  ├─ Recebimentos
│  ├─ Repasses e Convênio
│  ├─ Recorrência
│  └─ Planejamento
│
└─ NEUROFINANCE
   ├─ Conta e Saldo
   ├─ Área Pix
   │  ├─ Pagar Pix
   │  ├─ Gerar QR Code
   │  ├─ Minhas chaves
   │  ├─ Pagar salários
   │  └─ Limites
   ├─ Extrato da conta          ← lista que precisa casar com cobranças
   ├─ Cobranças bancárias
   │  ├─ Todas as cobranças     ← lista que precisa casar com extrato
   │  ├─ Simulador de vendas
   │  └─ Regras automáticas     ← placeholder
   ├─ Pagamentos
   │  ├─ Pagar boletos
   │  └─ Agendados
   ├─ Antecipação               ← “Em breve”
   ├─ Transferências            ← Pix de saída
   ├─ Saques
   │  ├─ Saques
   │  └─ Contas e Chaves
   ├─ Contestações
   ├─ NFS-e
   │  ├─ Dados Fiscais
   │  ├─ Emitir nota fiscal     ← “Em breve”
   │  └─ Minhas Notas Fiscais
   ├─ Tarifas
   └─ Ajustes
      └─ Saúde da conta
```

Há rotas antigas que ainda existem no tipo `FinanceView` e são redirecionadas: Fluxo de Caixa, Receitas, Despesas, Cobranças vencidas e Relatórios caem em Visão Geral, Lançamentos ou Recebimentos. O mapa abaixo descreve o que a pessoa encontra de verdade, não o que o tipo ainda aceita.

---

## Gestão Financeira

A Gestão não pede conta digital. Ela é o caderno. O tema claro usa painel claro com borda suave. O tema escuro usa o vidro ônix já padronizado em `finance-panel`. Qualquer lista nova nesta casa precisa nascer nos dois temas, com o mesmo `i` de coluna.

### Visão Geral

```text
gestao-visao-geral
│
├─ o que mostra
│  ├─ resultado do período
│  ├─ previsão
│  ├─ recebíveis
│  └─ pendências
│
├─ o que a pessoa faz
│  ├─ troca o recorte de tempo
│  ├─ abre um lançamento
│  └─ registra baixa quando o modelo permite
│
└─ o que a revisão pede
   ├─ os números daqui precisam usar as mesmas palavras das listas
   ├─ “em aberto” não pode significar uma coisa aqui e outra em Recebimentos
   └─ um atalho visível para cobrança vencida, convênio em atraso e saldo NeuroFinance, sem misturar os três num único card
```

Hoje esta aba resume o consultório a partir dos lançamentos gerenciais, com um recorte de contexto do NeuroFinance se a conta existir. Ela não explica, com a calma que o produto precisa, a diferença entre “o paciente ainda deve”, “a operadora ainda não pagou” e “o Pix já caiu mas ainda não pode ser sacado”.

### Cobranças Manuais

```text
gestao-cobrancas
│
├─ o que mostra
│  └─ a mesma tabela de ChargesWorkspace, no escopo “management”
│     colunas atuais: Paciente · Valor · Descrição · Origem · Status · Vencimento · Ações
│
├─ o que a pessoa faz
│  ├─ busca por paciente, descrição ou método
│  ├─ filtra por status, tipo, vencimento e data de recebimento
│  ├─ cria cobrança pelo ManualChargeModal
│  ├─ marca como paga
│  └─ cancela, se ainda não foi paga
│
└─ o que a revisão pede
   ├─ as colunas passam a seguir o dicionário único
   ├─ cada cabeçalho ganha o `i`
   ├─ método deixa de viver escondido embaixo da descrição
   ├─ status usa o vocabulário canônico, não só Planejada / Pendente / Vencida / Recebida / Cancelada
   └─ se a cobrança já foi paga, a ação visível deixa de ser “cancele” e passa a apontar para estorno ou reembolso, em vez de um texto que manda “usar estorno” sem tela
```

Esta é uma das duas listas que hoje confundem. Ela fala Recebida. O extrato fala Confirmado. A outra lista de cobranças, a bancária, usa o mesmo componente, então qualquer correção de coluna aqui precisa nascer também lá, com o mesmo dicionário, senão o problema só muda de lado.

### Lançamentos

```text
gestao-lancamentos
│
├─ o que mostra
│  └─ tabela: Data · Descrição · Categoria · Origem · Status · Valor
│     a descrição carrega o paciente em letra menor
│
├─ o que a pessoa faz
│  ├─ cria receita ou despesa
│  ├─ abre o detalhe
│  └─ registra baixa quando o lançamento ainda está em aberto
│
└─ o que a revisão pede
   ├─ Paciente vira coluna, não subtítulo
   ├─ Método vira coluna
   ├─ Status deixa de ser só Pago / Em aberto
   ├─ o `i` entra em cada cabeçalho
   └─ um lançamento de tarifa NeuroFinance, um Pix de paciente e um aluguel do consultório não podem parecer o mesmo tipo de linha
```

### Recebimentos

```text
gestao-recebimentos
│
├─ o que mostra
│  ├─ baixas já feitas
│  └─ valores ainda em aberto
│
├─ o que a pessoa faz
│  └─ registra recebimento manual
│
└─ o que a revisão pede
   ├─ separar com clareza: recebido do paciente, recebido da operadora, recebido na conta digital
   ├─ cobrança vencida não precisa de uma aba fantasma; ela vive aqui e em Cobranças, com o mesmo status Vencida
   └─ a baixa manual de convênio não pode parecer um Pix
```

### Repasses e Convênio

```text
gestao-repasses-convenio
│
├─ o que mostra hoje
│  ├─ cards de Recebido e Em aberto
│  └─ tabela: Paciente · Referência · Status · Valor · Em aberto · Ações
│
├─ o que a pessoa faz hoje
│  ├─ abre o lançamento
│  └─ registra recebimento, se o modelo permitir
│
└─ o que a revisão pede para a interface
   ├─ esta aba deixa de ser “mais uma lista de lançamentos filtrados”
   ├─ cada linha precisa mostrar operadora, paciente, sessão ou competência, valor da sessão, regra do repasse, valor esperado, previsão de queda, status do ciclo e o que falta fazer
   ├─ a baixa continua sendo gerencial até o dinheiro existir de verdade
   ├─ quando o dinheiro cair na conta NeuroFinance, a linha aponta para o movimento do extrato, sem duplicar o valor como se fosse outra receita
   └─ reembolso de particular e glosa de convênio ganham lugar visual, mesmo que a fase 1 só desenhe o estado vazio e o estado manual
```

O código atual é honesto em uma frase e omisso no resto. Ele diz que só entram lançamentos com vínculo estruturado de convênio, e que a baixa não inicia transferência bancária. A interface ainda não mostra a regra do convênio, o prazo de `expected_receipt_days`, o percentual ou o valor fixo de `repass_percentage` / `repass_value_cents`, nem o caminho até a conta digital.

### Recorrência

```text
gestao-recorrencia
│
├─ o que mostra
│  ├─ regras ativas de entrada e saída
│  ├─ grupo clínica / consultório
│  └─ grupo pessoal
│
├─ o que a pessoa faz
│  ├─ cria recorrência
│  ├─ pausa, retoma ou encerra
│  └─ vê ocorrências já geradas
│
└─ o que a revisão pede
   ├─ mensalidade de paciente, aluguel e assinatura NeuroNex não podem parecer a mesma coisa
   ├─ a ocorrência gerada precisa nascer já no dicionário de colunas
   └─ se a recorrência dispara cobrança bancária, a linha precisa dizer isso, em vez de a pessoa descobrir só em Cobranças bancárias
```

### Planejamento

```text
gestao-planejamento
│
├─ o que mostra
│  └─ metas e limites do período
│
├─ o que a pessoa faz
│  └─ define teto e objetivo
│
└─ o que a revisão pede
   └─ o planejamento só fica crível quando as listas de cima usam as mesmas palavras de receita, despesa, em aberto e previsto
```

---

## NeuroFinance

Esta casa só abre de verdade com plano ativo, conta criada e, em vários fluxos, conta aprovada. Enquanto o onboarding não termina, a pessoa vê a tela de ativação ou o aviso de pendência. O mapa abaixo descreve a casa já ligada.

### Conta e Saldo

```text
conta-digital
│
├─ o que mostra
│  ├─ saldo e atalhos da conta
│  ├─ linha do tempo de movimentos
│  └─ rodapé regulatório Asaas
│
├─ o que a pessoa faz
│  ├─ vai para Pix, saque, extrato futuro, pagamentos agendados
│  └─ acompanha o que já andou na conta
│
└─ o que a revisão pede
   ├─ o saldo disponível, o a receber e o bloqueado por contestação ou estorno precisam de nomes iguais aos do extrato
   └─ um movimento de tarifa, um Pix de paciente e um saque não podem cair na timeline com descrições opacas
```

### Área Pix

```text
Área Pix
├─ Pagar Pix            pix-pagar         cole o copia e cola e pague
├─ Gerar QR Code        pix-qrcode        cobre na hora, sem virar “cobrança de paciente” a menos que a pessoa vincule
├─ Minhas chaves        pix-chaves        chaves da conta
├─ Pagar salários       pix-salarios      Pix em lote
└─ Limites              pix-limites       tetos de segurança
```

A revisão não pede redesenhar o Pix nesta fase. Pede que um Pix recebido no extrato use as mesmas colunas e o mesmo status que o resto da conta, e que a origem diga se aquele Pix nasceu de uma cobrança, de um QR avulso ou de uma transferência.

### Extrato da conta

Esta é a outra lista que hoje não casa com Cobranças bancárias.

```text
extrato
│
├─ o que mostra hoje
│  ├─ KPIs: Saldo disponível · Quanto entrou · Quanto saiu · Quanto vai cair
│  ├─ abas: Realizado · Futuro e pendente · Assinaturas · atalho Pix recebidos
│  ├─ filtros de período, tipo, origem, método, paciente, destinatário, taxas
│  └─ lista em cartões, agrupada por data, sem cabeçalho de coluna
│
├─ campos que o cartão mistura
│  ├─ descrição
│  ├─ tag de origem (NeuroFinance / Lançamento gerencial / Agenda)
│  ├─ data do movimento
│  ├─ método em texto pequeno
│  ├─ paciente, se existir
│  ├─ valor
│  └─ status: Confirmado · Pendente · Em processamento · Vencido · Cancelado · Não concluído
│
├─ o que a pessoa faz
│  ├─ filtra, ordena, oculta valores, sincroniza, imprime
│  └─ abre o detalhe da transação
│
└─ o que a revisão pede
   ├─ o extrato detalhado vira lista com as mesmas colunas-mãe das cobranças
   ├─ cada coluna ganha o `i` à direita
   ├─ Realizado usa Competência = data do movimento
   ├─ Futuro usa Competência = previsão / vencimento
   ├─ Assinaturas não é um terceiro vocabulário; é um filtro sobre a mesma lista
   ├─ tarifa, estorno, reembolso, contestação, saque e Pix ganham Origem e Método explícitos
   └─ claro e escuro preservam tabela, `i`, foco e o painel de ajuda da coluna
```

O detalhe atual, `TransactionDetailView`, mostra valor, origem, método, status, paciente e documentos de recibo ou fatura. Ele não oferece estornar, reembolsar, ver a cobrança irmã nem entender se aquele valor ainda pode ser sacado. A fase 1 precisa desenhar esses caminhos no detalhe, mesmo que a execução real fique para a fase de backend.

### Cobranças bancárias

```text
cobrancas-historia          Todas as cobranças
cobrancas-simulador         Simulador de vendas
cobrancas-config            Regras automáticas   ← tela de “em breve” educada
cobrancas-chargebacks       vive no grupo Contestações da sidebar
```

#### Todas as cobranças

```text
Todas as cobranças
│
├─ o que mostra hoje
│  └─ ChargesWorkspace no escopo “neurofinance”
│     colunas: Paciente · Valor · Descrição · Origem · Status · Vencimento · Ações
│     origem aqui é Avulsas / Assinaturas / Parceladas, não Agenda / Manual / Convênio
│
├─ o que a pessoa faz
│  ├─ busca por descrição ou número
│  ├─ filtra
│  ├─ cria cobrança pelo NewInvoiceModal (Pix, boleto, cartão, paciente escolhe)
│  ├─ sincroniza com o provedor
│  ├─ copia o link
│  └─ exclui se ainda estiver pendente ou vencida
│
└─ o que a revisão pede
   ├─ Origem deixa de significar uma coisa na gestão e outra aqui
   ├─ tipo (avulsa, assinatura, parcelada) vira um campo à parte, não “origem”
   ├─ as colunas casam com o extrato
   ├─ o `i` entra
   ├─ cobrança paga não desaparece num limbo de “não pode excluir”; ela oferece detalhe, recibo, estorno e, quando fizer sentido, reembolso ao paciente
   └─ se a cobrança nasceu da agenda, a linha aponta para a sessão
```

Há um detalhe importante de produto: a mesma família visual serve Gestão > Cobranças Manuais e NeuroFinance > Todas as cobranças. Isso é bom, se o dicionário for um só. Hoje o componente reutiliza o grid e troca o significado de Origem e o conjunto de ações. A revisão pede reutilizar o esqueleto, não o vocabulário solto.

#### Simulador de vendas

Mostra taxa e líquido antes de cobrar. Deve continuar. Só precisa usar as palavras Valor, Taxa e Líquido iguais às colunas da lista e à aba Tarifas.

#### Regras automáticas

Hoje é um aviso de que no futuro o sistema cobrará consulta, pacote e assinatura sozinho. A fase 1 pode deixar a tela mais honesta: o que já é recorrência na Gestão, o que já nasce da agenda, e o que ainda não está no piloto automático. Não precisa fingir o motor.

### Pagamentos

```text
pagamentos-boletos      pagar boleto por linha, imagem ou PDF
pagamentos-agendados    programações e histórico
```

Há views extras no código, como grupos e “pagar contas”, que a sidebar atual não destaca. A revisão pede não inflar a sidebar nesta fase. Pede que um boleto pago saia no extrato com Método Boleto, Origem Pagamento e Status canônico, inclusive quando for estornado.

### Antecipação

Marcada “Em breve”. A ficha da aba deve continuar existindo, com o mesmo tom visual das outras, sem parecer quebrada. Quando a fase 2 ligar o motor, Líquido e prazo precisam nascer já no dicionário de colunas.

### Transferências e Saques

```text
pix-transferir      envia Pix para uma chave
transferencias      saca o saldo para a conta cadastrada
contas-bancarias    conta e chave de destino
```

Aqui mora um dos dois “repasses”. Sacar para a conta do psicólogo é o repasse da conta digital. A interface precisa chamar isso de Saque ou de Transferência para a conta, e reservar a palavra Repasse para o ciclo de convênio, ou então qualificar sempre: “Repasse da conta” versus “Repasse de convênio”. A revisão recomenda não usar a palavra Repasse sozinha em lugar nenhum.

### Contestações

```text
cobrancas-chargebacks
│
├─ o que mostra hoje
│  └─ cards vermelhos a partir de neurofinance_chargebacks_v
│     descrição, motivo ou status da disputa, valor
│
└─ o que a revisão pede
   ├─ contestação é um estado da cobrança e um movimento do extrato, não um recorte isolado
   ├─ a lista usa as mesmas colunas
   ├─ o `i` de Status explica a diferença entre contestação, estorno e reembolso
   └─ a pessoa precisa ver o que aconteceu com o saldo e o que ela ainda pode fazer
```

### NFS-e, Tarifas e Saúde da conta

```text
fiscal-dados     dados usados na nota
fiscal-nova      emitir, ainda “Em breve”
fiscal-lista     histórico
tarifas          custos e prazos
saude-conta      KYC, pendências, análise Asaas
```

A fase 1 não precisa concluir a emissão. Precisa garantir que, quando uma nota existir, o detalhe da cobrança e o detalhe do extrato apontem para ela com a mesma palavra: Nota fiscal. Tarifas precisam usar Taxa e Líquido iguais ao simulador e à coluna Líquido. Saúde da conta continua sendo o lugar do cadastro, não o lugar do convênio de paciente.

---

## O casamento visual que as duas listas precisam ter

Este é o exemplo pedido: o mesmo mapa, lado a lado, para a pessoa não ter de adivinhar.

```text
                    COBRANÇAS BANCÁRIAS                 EXTRATO DETALHADO
                    (hoje)                              (hoje)
                    ─────────────────────               ─────────────────────
Cabeçalho           tabela com nomes                    não existe
Paciente            coluna 1                            só se couber no cartão
Valor               coluna 2                            à direita, sem nome
Descrição           coluna 3                            título do cartão
Método              subtítulo da descrição              texto pequeno no meio
Origem              Avulsa / Assinatura / Parcela       tag NeuroFinance / Manual / Agenda
Status              Recebida / Pendente / Vencida       Confirmado / Pendente / …
Competência         Vencimento                          data do movimento, sem nome
Líquido             não aparece                         não aparece
Ações               ícones à direita                    clicar no cartão inteiro
Ajuda da coluna     não existe                          não existe


                    ALVO DAS DUAS LISTAS
                    ────────────────────────────────────────────
                    Paciente i | Descrição i | Origem i | Método i
                    Competência i | Status i | Valor i | Líquido i | Ações
```

O `i` fica colado à direita do nome, nunca no lugar do nome, nunca só no hover sem teclado, nunca com cor que desapareça no tema claro ou no tema escuro.

---

## O que este mapa recusa de propósito

Ele recusa tratar portal e mobile. O portal hoje tem um extrato simples em `PatientFinancePanel`, com “Total Investido” e cartões. O mobile profissional tem abas Extrato e Cobranças próprias. Os dois serão fases posteriores, copiando o dicionário, não o layout desktop.

Ele recusa fundir Gestão e NeuroFinance numa casa só. As duas continuam. O que se unifica é a língua, as colunas e o ciclo de estados.

Ele recusa implementar nesta leitura. O próximo passo, quando você mandar isto ao agente, é o plano. Não é o pull request.
