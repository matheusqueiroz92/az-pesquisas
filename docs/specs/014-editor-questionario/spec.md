# Spec 014 — Editor de questionário

- Status: implementada (aguardando revisão)
- Fase: F1
- Aprovada por: Matheus (ordem da F1 combinada em 2026-11-05)

## Contexto

Cada pesquisa tem um questionário. Ele é editado como **rascunho** e, na spec 015, publicado em **versões imutáveis** (o _snapshot_ da spec 006, que o app baixa e que vira o PDF do TSE). Esta spec entrega o rascunho e o editor no painel. Planejamento funcional › Questionário (editor), Tipos de pergunta, Configurações de cada pergunta, Modelo de domínio e versionamento.

## Quem pode

1. Ver e editar o questionário exige `surveys.manage` (administrador e coordenador).

## O rascunho

2. Uma pesquisa tem um rascunho de questionário: um texto de abertura opcional e uma lista ordenada de perguntas (até 500).
3. Os dez tipos de pergunta do contrato do app (spec 006), com as mesmas configurações:

| Tipo             | Configurações                                                          |
| ---------------- | ---------------------------------------------------------------------- |
| Escolha única    | opções; embaralhar; opção fixa; uma opção "Outro (especificar)"        |
| Múltipla escolha | o mesmo, mais opção exclusiva ("Nenhuma") e mínimo/máximo de marcações |
| Resposta livre   | curta ou longa; limite de caracteres                                   |
| Numérica         | inteiro ou decimal; mínimo, máximo; unidade                            |
| Escala           | de/até (ex.: 0–10, 1–5) e rótulos das pontas                           |
| Matriz           | itens (linhas) com as mesmas colunas de resposta                       |
| Ranking          | opções; quantas ordenar (ex.: as 3 primeiras)                          |
| Data             | data mínima e máxima                                                   |
| Foto             | quantas fotos (1 a 5)                                                  |
| Assinatura       | —                                                                      |

4. Toda pergunta tem **código** (variável da exportação, ex.: `P01_SEXO`), enunciado, instrução para o pesquisador (não lida ao entrevistado) e obrigatória sim/não. Toda opção e linha tem código (o valor exportado, ex.: `1`, `NS_NR`) e rótulo.
5. **Identificadores estáveis.** Cada pergunta, opção e linha recebe um id que não muda quando o texto, o código ou a ordem mudam. É ele que soma respostas de versões diferentes (spec 015 em diante).
6. **Lógica de exibição.** Uma pergunta pode aparecer só quando uma condição sobre perguntas **anteriores** é verdadeira ("mostre P5 só se P2 = Sim"). O editor monta condições de um nível: várias comparações ligadas por "todas" ou "qualquer uma". "Pule de P3 para P7" é a mesma coisa vista do outro lado: P4 a P6 aparecem só se P3 não for X. Comparações possíveis: igual / diferente / está entre / não está entre (escolha), maior, menor etc. (numérica e escala), respondida / não respondida (qualquer tipo).
7. **Mudar o código** de uma pergunta atualiza as condições que a citam.
8. O rascunho pode ficar incompleto enquanto é editado (pergunta sem texto, só uma opção). O editor mostra a lista de **pendências** que impedirão a publicação (015), apontando a pergunta: texto vazio, código inválido ou repetido, poucas opções, mínimo maior que máximo, condição que cita pergunta posterior ou inexistente etc. A regra final é a do contrato do app (spec 006): um rascunho sem pendências vira um snapshot válido.

## Editor no painel

9. Página **Questionário** da pesquisa: lista de perguntas à esquerda (arrastar e soltar para reordenar, ou botões subir/descer pelo teclado), edição da pergunta escolhida ao centro e **pré-visualização como no celular** ao lado.
10. Adicionar pergunta escolhendo o tipo; o código sugerido é o próximo `Pnn` livre e as opções vêm numeradas (`1`, `2`…). Duplicar e remover pergunta; adicionar, reordenar e remover opções e linhas.
11. **Salvamento automático** pouco depois de cada mudança, com indicação "Salvando…/Salvo". Se outra pessoa (ou outra aba) salvou antes, nada é sobrescrito: o editor avisa e oferece recarregar.
12. Ao sair da página com alterações não salvas, o navegador pergunta antes.

## Travas

13. Pesquisa **arquivada**: questionário só para leitura.
14. Pesquisa **eleitoral com número de registro no TSE**: questionário só para leitura (Resolução TSE 23.600: o questionário registrado não muda). Antes da publicação, quem registrou por engano apaga o número na pesquisa; depois dela, a trava é definitiva (015).
15. **Duplicar a pesquisa** copia o rascunho do questionário, com ids novos (a cópia é outra pesquisa).

## Critérios de aceite

### CA-01 — Montar um questionário

- **Dado** um coordenador numa pesquisa em rascunho
- **Quando** adiciona uma escolha única "Sexo" com duas opções e uma numérica "Idade" de 16 a 120
- **Então** depois de recarregar a página as duas perguntas estão lá, na ordem, sem pendências

### CA-02 — Reordenar

- **Dado** duas perguntas
- **Quando** a segunda é levada para o topo (arrastando ou pelo botão)
- **Então** a ordem salva é a nova, e os ids não mudam

### CA-03 — Lógica de exibição

- **Dado** P01 (escolha única Sim/Não) e P02
- **Quando** P02 recebe "mostrar se P01 = Sim" e depois P01 é renomeada para `P01_VOTA`
- **Então** a condição passa a citar `P01_VOTA`; se P02 for movida para antes de P01, aparece a pendência "condição cita pergunta que não vem antes"

### CA-04 — Pendências

- **Dado** uma escolha única com uma opção só, ou duas perguntas com o mesmo código
- **Quando** o editor mostra o questionário
- **Então** a pendência aparece na pergunta; o salvamento continua funcionando

### CA-05 — Rascunho válido vira snapshot

- **Dado** qualquer rascunho sem pendências
- **Quando** convertido no formato do app
- **Então** o `QuestionnaireSnapshot` da spec 006 aceita (teste automatizado)

### CA-06 — Edição concorrente

- **Dado** duas abas com o mesmo questionário
- **Quando** as duas salvam
- **Então** a segunda recebe `QUESTIONNAIRE_CONFLICT` e não apaga o trabalho da primeira

### CA-07 — Travas

- **Dado** uma pesquisa arquivada, ou eleitoral com número de registro no TSE
- **Quando** alguém tenta salvar o questionário
- **Então** recebe `QUESTIONNAIRE_LOCKED`; o editor abre só para leitura, explicando o motivo

### CA-08 — Duplicar pesquisa

- **Dado** uma pesquisa com questionário
- **Quando** duplicada
- **Então** a cópia tem as mesmas perguntas (mesmos códigos e textos), com ids novos

### CA-09 — Isolamento e permissão

- **Dado** outra organização, ou analista, cliente ou pesquisador
- **Quando** tenta ler ou salvar o questionário
- **Então** recebe 404 (outra organização) ou 403 (papel)

## Alterações

1. **2026-11-06 — blocos prontos de perfil** (pedido do Matheus). O editor ganha "Inserir bloco pronto":
   - **Perfil básico:** sexo, faixa etária (16–24, 25–34, 35–44, 45–59, 60+) e escolaridade.
   - **Perfil completo:** o básico mais renda familiar, religião, ocupação e zona urbana/rural.
   - Entram no início, no fim ou depois da pergunta escolhida, como perguntas comuns e editáveis; perguntas de perfil que o questionário já tem não se repetem.
   - Cada uma leva a **variável de perfil** (`profile`, campo opcional novo no contrato da spec 006). É por ela que a ponderação e os cruzamentos (018) acham "a pergunta de sexo", qualquer que seja o texto. Dá para desvincular. Duas perguntas com a mesma variável viram pendência (`PROFILE_REPEATED`).
   - Só os modelos que vêm com o sistema; modelos próprios da empresa ficam para depois.

### CA-10 — Bloco pronto (alteração 1)

- **Dado** um questionário com uma pergunta
- **Quando** o coordenador insere o "Perfil básico" no início e depois tenta inserir de novo
- **Então** entram SEXO, FAIXA_ETARIA e ESCOLARIDADE antes da pergunta existente, editáveis e marcadas como variáveis de perfil; na segunda vez nada é repetido

## Fora de escopo

- Publicar versão, comparar versões, avisos de comparabilidade e desativar perguntas em vez de apagar (015).
- PDF do questionário (015).
- Pergunta "espontânea" codificada depois em categorias (com os resultados, 018).
- Condições aninhadas no editor (o contrato aceita; o editor monta um nível).
- Banco de perguntas reutilizáveis e importação de questionário de arquivo (F2).
