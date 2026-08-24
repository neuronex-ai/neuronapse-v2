# NeuroFinance — contratos de cobrança, repasse, saúde e documentos

**Status:** fonte de verdade para a revisão do financeiro profissional desktop  
**Superfície desta fase:** `/financeiro` no desktop/tablet, temas claro e escuro  
**Fora desta fase:** onboarding da conta, portal do paciente, mobile, TISS/TUSS e integrações com operadoras

Este documento completa `NEUROFINANCE_REVISAO_PROFUNDA.md` e
`NEUROFINANCE_MAPA_ABAS_DESKTOP.md`. Ele fixa a linguagem que deve ser usada na
interface sem unificar fisicamente `financial_entries` e `nb_payments`.

## Colunas-mãe

As listas de cobranças e o extrato detalhado usam, nesta ordem:

```text
Paciente i | Descrição i | Origem i | Método i | Competência i
Status i | Valor i | Líquido i | Ações
```

- **Paciente:** pessoa vinculada; quando não existir, mostrar “Sem paciente”.
- **Descrição:** nome humano da operação. Tipo — Avulsa, Assinatura ou Parcelada — é metadado próprio.
- **Origem:** Agenda, Manual, NeuroFinance, Pagamento, Convênio, Pacote ou Recorrência. Pagamento é usado para saídas iniciadas nos fluxos de contas/boletos.
- **Método:** Pix, Boleto, Cartão, Dinheiro, Convênio, Transferência, Baixa manual, A combinar ou Não informado.
- **Competência:** vencimento na cobrança, movimento no extrato realizado e previsão/vencimento no extrato futuro.
- **Status:** estado canônico da operação, nunca o valor bruto retornado pelo provedor.
- **Valor:** valor de face, em reais.
- **Líquido:** valor depois de tarifa/ajuste; “A calcular” quando desconhecido e “Não se aplica” na Gestão.
- **Ações:** somente capacidades realmente possíveis no estado atual.

O `i` permanece ao lado do nome, possui nome acessível, foco visível e abre uma
introdução contextual que fecha por Escape e devolve o foco ao acionador.

## Estados canônicos

| Código | Interface | Significado |
| --- | --- | --- |
| `planned` | Planejada | Registro previsto, ainda não exigível. |
| `pending` | Pendente | Aguarda pagamento ou conclusão. |
| `overdue` | Vencida | Prazo passou sem confirmação. |
| `processing` | Em processamento | Operação aceita e ainda sendo concluída. |
| `confirmed` | Confirmada | Pagamento ou movimento concluído. Não implica saldo disponível. |
| `cancelled` | Cancelada | Operação encerrada antes da confirmação. |
| `reversal_pending` | Estorno em processamento | Reversão iniciada e ainda não concluída. |
| `reversed` | Estornada | Lançamento ou movimento revertido. |
| `refund_pending` | Reembolso em processamento | Devolução ao pagador iniciada. |
| `refunded` | Reembolsada | Dinheiro devolvido ao pagador. |
| `disputed` | Contestada | Pagamento sob disputa. |
| `failed` | Não concluída | Operação recusada ou encerrada com falha. |

A disponibilidade é separada do status: `A liberar`, `Disponível`, `Bloqueado`
ou `Não se aplica`.

## Cancelamento, estorno, reembolso e contestação

- **Cancelamento** encerra uma cobrança não paga e preserva o histórico.
- **Estorno** reverte um lançamento ou movimento confirmado e cria uma relação com o original.
- **Reembolso** devolve dinheiro ao pagador. No NeuroFinance, depende da operação idempotente do provedor.
- **Contestação** é uma disputa do ecossistema do cartão; não é tratada como cancelamento ou reembolso.

Uma operação confirmada nunca oferece exclusão. Ela oferece detalhe, documento e,
quando aplicável, estorno ou reembolso.

## Convênio e repasse

“Repasse” nunca aparece sem qualificador. A Gestão usa **Repasse de convênio**;
a conta usa **Saque** ou **Transferência para sua conta**.

O ciclo de convênio contém operadora, paciente, sessão/competência, valor da
sessão, regra, valor esperado, previsão, status e próxima ação. A baixa permanece
gerencial até existir um movimento bancário real. Ao conciliar, o registro aponta
para o movimento NeuroFinance sem criar uma segunda receita.

Glosa e reembolso particular possuem estados vazios e manuais nesta fase. Não há
integração TISS/TUSS ou com portais de operadoras.

## Comprovante NeuroNex e documentos oficiais

O documento gerado pela NeuroNex é **Comprovante de pagamento**. Ele não se
declara autenticado, assinado digitalmente ou fiscal sem prova técnica.

Para pessoa física, a interface prepara os dados usados no Receita Saúde — CPF do
pagador, CPF do beneficiário quando diferente, valor, data do pagamento e, quando
úteis, descrição e data do atendimento — e deixa explícito que a transmissão
oficial ocorre fora da NeuroNex nesta fase. Para pessoa jurídica, NFS-e permanece
um documento separado.

Comprovantes Asaas, comprovantes NeuroNex e notas fiscais recebem nomes e links
distintos. A atribuição Asaas aparece somente quando a operação foi processada
pelo NeuroFinance.

## Materiais e percepção

Liquid Glass é reservado a navegação, barras, controles e apresentação. Conteúdo,
tabelas e o papel A4 usam superfícies estáveis. A organização aplica proximidade
e região comum dentro dos grupos, maior distância entre grupos, alinhamento de
colunas, similaridade de estados e continuidade das linhas. Não são usados grão,
ruído, halos locais ou vidro empilhado.
