# Spec 016 — Dispositivos e equipe da pesquisa

- Status: implementada (aguardando revisão)
- Fase: F1
- Aprovada por: Matheus (ordem combinada em 2026-11-06)

## Contexto

Os tablets da empresa precisam ser **vinculados** à organização antes de coletar, e cada pesquisa precisa saber **em quais aparelhos** vai a campo e **quais pesquisadores** podem aplicá-la. A sincronização (017) usa essas atribuições para entregar a cada aparelho as versões publicadas das suas pesquisas e a lista de quem pode entrar nele. Planejamento funcional › Dispositivos, offline e sincronização › Vinculação do dispositivo; › Modelo de domínio (dispositivo, atribuição).

## Quem pode

1. Vincular, renomear e revogar aparelhos e montar a equipe das pesquisas exigem `devices.manage` (administrador e coordenador).

## Vincular um aparelho

2. No painel, **Vincular dispositivo** gera um **código de 6 dígitos válido por 10 minutos**, de uso único. O painel mostra o código e acompanha sozinho até o aparelho usá-lo.
3. No app, na primeira abertura (com internet), a tela **Vincular este aparelho** pede o código. A API registra o aparelho (plataforma, modelo, versão do sistema e do app) e devolve um **token de dispositivo** de longa duração, guardado no armazenamento seguro do aparelho. Só depois disso o app mostra o login.
4. O código é conferido sem saber de qual organização ele é: errar o código, ou usar um vencido ou já usado, dá a mesma resposta ("código inválido ou vencido"). Tentativas são limitadas por IP.
5. O aparelho nasce com o apelido "Aparelho N"; o coordenador pode renomear (ex.: "Tablet 03 – equipe Itapetinga").
6. O banco guarda só o _hash_ do token e do código (AGENTS.md regra 10).

## Aparelhos no painel

7. A tela **Dispositivos** lista apelido, modelo, plataforma, versão do app, quando foi vinculado, **última comunicação**, situação (ativo/revogado) e as pesquisas atribuídas.
8. **Revogar** invalida o token na hora: a próxima comunicação do aparelho é recusada e o app volta para a tela de vinculação. As atribuições do aparelho são desfeitas. Aparelho revogado continua na lista (histórico), não volta a ser ativo e não recebe pesquisas. O envio final das entrevistas que ainda estiverem no aparelho é tratado com a sincronização (017).
9. O app avisa a API ao abrir (com rede), o que atualiza a "última comunicação" e a versão do app.

## Equipe da pesquisa

10. A pesquisa ganha a aba **Equipe**: marcar os **aparelhos** (ativos) e os **pesquisadores** (usuários ativos com papel pesquisador) da pesquisa, e salvar.
11. Pesquisa arquivada ou encerrada não recebe equipe nova (`SURVEY_NOT_ASSIGNABLE`); a equipe existente fica registrada.
12. Mudanças de equipe, vinculação, renomeação e revogação vão para o log de auditoria.

## Fora desta spec (vêm na 017)

- Download das versões e da lista de pesquisadores pelo aparelho; login do pesquisador com PIN, também offline; bateria e envio das entrevistas.
- Leitura de **QR code** no app: a câmera entra com o build do app (011); por enquanto o código de 6 dígitos é digitado.

## Critérios de aceite

### CA-01 — Vincular

- **Dado** um coordenador que gerou um código
- **Quando** o app envia o código em até 10 minutos
- **Então** o aparelho aparece no painel como "Aparelho N", ativo, com modelo e versão; o painel mostra que vinculou; o código não serve uma segunda vez

### CA-02 — Código errado ou vencido

- **Dado** um código inexistente, vencido ou já usado
- **Quando** o app tenta vincular
- **Então** recebe `PAIRING_CODE_INVALID`, sem saber qual dos três; depois de 10 tentativas por minuto, 429

### CA-03 — Token do aparelho

- **Dado** um aparelho vinculado
- **Quando** o app avisa a API com o token
- **Então** a última comunicação e a versão do app são atualizadas; com token desconhecido ou de aparelho revogado, 401 `DEVICE_TOKEN_INVALID`

### CA-04 — Revogar

- **Dado** um aparelho com pesquisas atribuídas
- **Quando** o coordenador revoga
- **Então** o token deixa de valer, as atribuições somem e o aparelho não pode receber pesquisas

### CA-05 — Equipe

- **Dado** uma pesquisa em campo, dois aparelhos ativos e três pesquisadores
- **Quando** o coordenador marca um aparelho e dois pesquisadores e salva
- **Então** a equipe fica gravada; marcar um aparelho revogado, um usuário que não é pesquisador ou uma pesquisa arquivada é recusado

### CA-06 — App

- **Dado** o app sem vínculo
- **Quando** abre
- **Então** pede o código; vinculado, mostra o login; revogado no painel, volta a pedir o código na próxima abertura com rede

### CA-07 — Isolamento e permissão

- **Dado** outra organização, ou analista, cliente ou pesquisador
- **Quando** tenta ver ou mexer em aparelhos, códigos ou equipes
- **Então** recebe 404 ou 403
