# Spec 015 — Publicação de versão do questionário

- Status: implementada (aguardando revisão)
- Fase: F1
- Aprovada por: Matheus (ordem combinada em 2026-11-06)

## Contexto

O rascunho do questionário (spec 014) é editado livremente. O que vai para os aparelhos, o que as entrevistas apontam e o que é registrado no TSE é uma **versão publicada**: o _snapshot_ da spec 006, imutável. Planejamento funcional › Modelo de domínio e versionamento; › Pesquisa eleitoral (TSE).

## Quem pode

1. Publicar exige `surveys.publish`; encerrar e reabrir o campo, `surveys.manage` (administrador e coordenador têm as duas).

## Publicar

2. **Publicar** transforma o rascunho salvo em uma nova versão numerada (v1, v2…): perguntas, texto de abertura, título da pesquisa e as configurações de coleta (GPS, áudio, duração mínima, consentimento) daquele momento.
3. Só publica um rascunho **sem pendências** (spec 014). O rascunho publicado é exatamente o que o coordenador viu: a publicação informa a revisão salva e é recusada se outra pessoa salvou depois (`QUESTIONNAIRE_CONFLICT`).
4. Rascunho igual à última versão não vira versão nova (`QUESTIONNAIRE_UNCHANGED`).
5. **Uma versão nunca muda nem é apagada** (AGENTS.md regra 7), garantido também pelo banco.
6. A primeira publicação tira a pesquisa do rascunho: ela fica **em campo**.

## Mudanças entre versões

7. Antes de publicar, o painel mostra o que muda em relação à versão anterior e pede confirmação:
   - perguntas e opções **novas**;
   - perguntas e opções **retiradas** (as respostas já coletadas continuam nos resultados; elas só deixam de aparecer nas próximas entrevistas — é a "desativação em vez de exclusão" do planejamento);
   - **texto** de pergunta ou opção alterado (as respostas antigas foram dadas ao texto anterior);
   - **código** de pergunta ou opção alterado (a exportação de cada versão usa o código daquela versão).
     Opção nova ou retirada com a pesquisa em campo aparece como **aviso de comparabilidade**.
8. Perguntas e opções são comparadas pelos ids estáveis (spec 014), nunca pela posição.
9. Uma pergunta não muda de tipo entre versões: o editor não deixa, e a publicação recusa (`QUESTIONNAIRE_INCOMPATIBLE`).

## Pesquisa eleitoral registrada no TSE

10. Para publicar uma pesquisa eleitoral marcada como registrada, a ficha técnica tem de estar completa: número de registro, estatístico responsável, registro no Conre, contratante e valor (`SURVEY_TSE_INCOMPLETE`, com os campos que faltam).
11. Depois da primeira publicação, o registro é definitivo: não dá para desmarcar o registro nem trocar o número (`SURVEY_FIELD_LOCKED`), e o questionário continua só para leitura.

## Situação da pesquisa

12. Ciclo completo: rascunho → em campo (primeira publicação) ⇄ encerrada (**Encerrar campo** / **Reabrir campo**). Arquivar vale para rascunho e encerrada; desarquivar devolve a pesquisa para onde estava (rascunho se nunca foi publicada, senão encerrada).
13. Depois da primeira publicação, os dados da pesquisa continuam editáveis (período, meta, municípios…), menos o **tipo** (`SURVEY_FIELD_LOCKED`). Excluir continua só para rascunho.
14. Publicar, encerrar e reabrir vão para o log de auditoria.

## Versões no painel

15. A aba **Versões** da pesquisa lista as versões (número, data, número de perguntas, resumo das mudanças). Quem publicou fica no log de auditoria.
16. Cada versão abre numa **página de impressão** com o questionário completo, como aplicado: identificação da pesquisa, ficha técnica (incluindo os dados do TSE), texto de abertura e perguntas numeradas com opções, códigos e regras de exibição escritas por extenso. "Imprimir / salvar em PDF" usa a impressão do navegador. É esse PDF que vai para o PesqEle.

## Critérios de aceite

### CA-01 — Primeira publicação

- **Dado** uma pesquisa em rascunho com questionário sem pendências
- **Quando** o coordenador publica
- **Então** nasce a v1 com o snapshot válido para o app, e a pesquisa passa a "em campo"

### CA-02 — Pendências e conflito

- **Dado** um rascunho com pendência, ou uma revisão desatualizada
- **Quando** alguém tenta publicar
- **Então** recebe `QUESTIONNAIRE_NOT_PUBLISHABLE` (com as pendências) ou `QUESTIONNAIRE_CONFLICT`

### CA-03 — Mudanças

- **Dado** a v1 publicada
- **Quando** o rascunho ganha uma opção, perde uma pergunta e corrige um texto
- **Então** a prévia lista as três mudanças com os avisos, a v2 é publicada com o resumo, e a v1 continua igual

### CA-04 — Imutabilidade

- **Dado** uma versão publicada
- **Quando** o usuário do banco da aplicação tenta alterá-la ou apagá-la
- **Então** o banco recusa

### CA-05 — TSE

- **Dado** uma pesquisa eleitoral registrada sem o nome do estatístico
- **Quando** alguém tenta publicar
- **Então** recebe `SURVEY_TSE_INCOMPLETE`; completa e publicada, o número do registro não pode mais ser trocado nem apagado

### CA-06 — Situação

- **Dado** uma pesquisa em campo
- **Quando** o campo é encerrado, arquivado, desarquivado e reaberto
- **Então** passa por encerrada → arquivada → encerrada → em campo, e o tipo não pode mudar

### CA-07 — Página de impressão

- **Dado** a v1 publicada
- **Quando** o coordenador abre a versão
- **Então** vê o questionário completo com a ficha técnica e o botão de imprimir

### CA-08 — Isolamento e permissão

- **Dado** outra organização, ou analista, cliente ou pesquisador
- **Quando** tenta publicar, listar ou ler versões
- **Então** recebe 404 ou 403

## Fora de escopo

- Entrega das versões aos aparelhos (016/017) e "entrevista iniciada numa versão termina nessa versão" (017).
- PDF gerado no servidor, com identidade visual do relatório (019).
- Comparar duas versões quaisquer lado a lado (só a anterior com a nova).
