# Spec 013 — Clientes e pesquisas

- Status: implementada (aguardando revisão)
- Fase: F1
- Aprovada por: Matheus (ordem da F1 combinada em 2026-11-05: 013 → 014 → 015 → 016)

## Contexto

Antes de montar questionário, publicar versão ou atribuir tablets, a coordenação precisa cadastrar **para quem** é a pesquisa (cliente) e **o que** é a pesquisa: tipo, período de campo, municípios, meta, como o app trata GPS e áudio e, se for eleitoral registrada no TSE, os dados que vão para a ficha técnica. Planejamento funcional › Painel web › Pesquisas; › Pesquisa eleitoral (TSE).

Esta spec cria o cadastro. O questionário é a 014; a publicação de versão (que tira a pesquisa do rascunho e congela as configurações no snapshot) é a 015; dispositivos e atribuição, a 016.

## Quem pode

1. Clientes e pesquisas exigem a permissão `surveys.manage` (administrador e coordenador). Analista e cliente passam a ver pesquisas junto com os resultados (018 e F2); pesquisador nunca vê o painel.

## Clientes

2. Um cliente tem **nome** (2 a 120 caracteres), **CPF ou CNPJ** opcional (dígitos verificadores conferidos; guardado só com números), **pessoa de contato**, **e-mail** e **telefone** opcionais.
3. Dá para criar, editar e listar clientes (em ordem alfabética, com o número de pesquisas de cada um).
4. Cliente sem pesquisas pode ser excluído. Cliente com pesquisas (inclusive arquivadas) não pode: o sistema avisa quantas pesquisas o usam.

## Pesquisas

5. Campos:

| Campo                  | Regra                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------- |
| Título                 | 3 a 160 caracteres                                                                      |
| Cliente                | um cliente da organização, ou nenhum (pesquisa própria)                                 |
| Tipo                   | satisfação, mercado, opinião pública, avaliação municipal ou eleitoral                  |
| Municípios             | zero ou mais municípios da Bahia (código IBGE); sem repetição                           |
| Período de campo       | início e fim opcionais (datas); fim não pode ser antes do início                        |
| Meta de entrevistas    | opcional, de 1 a 1.000.000                                                              |
| GPS                    | desligado, opcional ou obrigatório (padrão: opcional)                                   |
| Áudio                  | ligado ou desligado (padrão: desligado)                                                 |
| Duração mínima         | 0 a 7.200 segundos (padrão 0); entrevistas mais curtas ficam sinalizadas para auditoria |
| Texto de consentimento | opcional, até 2.000 caracteres, lido no início da entrevista                            |

6. **Eleitoral.** Só no tipo eleitoral aparece "Registrada no TSE". Marcada, a pesquisa guarda também: número de registro no TSE (formato `UF-00000/AAAA`, ex.: `BA-01234/2026`), estatístico responsável, registro no Conre, contratante e valor contratado (em reais). Todos são opcionais no rascunho, porque o registro no PesqEle acontece depois que o questionário está pronto; a publicação (015) decide o que passa a ser obrigatório. Pesquisa de outro tipo, ou eleitoral não registrada, **não guarda** esses dados: ao mudar o tipo ou desmarcar o registro, eles são apagados.
7. Situações: rascunho, em campo, encerrada e arquivada. Nesta spec uma pesquisa nasce em **rascunho** e só pode ir para **arquivada** e voltar. "Em campo" e "encerrada" chegam com a publicação e a atribuição (015/016).
8. **Rascunho** pode ser editado em tudo e excluído. Pesquisa arquivada não é editada nem excluída: primeiro se desarquiva.
9. **Duplicar** cria uma pesquisa nova em rascunho com o título "Cópia de …" e as mesmas configurações, municípios e cliente, sem período de campo e sem número de registro no TSE (o registro é de uma pesquisa só). Quando houver questionário (014), a cópia leva o rascunho do questionário.
10. A lista de pesquisas mostra título, cliente, tipo, situação, período e meta; por padrão esconde as arquivadas, com um filtro para vê-las. Busca por título.
11. Criar, editar, arquivar, desarquivar, duplicar e excluir ficam no log de auditoria, sem os valores dos campos (só quais campos mudaram).

## Critérios de aceite

### CA-01 — Cadastro de cliente

- **Dado** um coordenador
- **Quando** cadastra "Prefeitura de Itapetinga" com CNPJ válido e depois edita o contato
- **Então** o cliente aparece na lista com 0 pesquisas, e o CNPJ fica guardado só com números

### CA-02 — Documento inválido

- **Dado** um CNPJ ou CPF com dígito verificador errado
- **Quando** enviado
- **Então** é recusado apontando o campo

### CA-03 — Cliente em uso

- **Dado** um cliente com uma pesquisa arquivada
- **Quando** alguém tenta excluí-lo
- **Então** recebe `CLIENT_IN_USE`; sem pesquisas, a exclusão funciona

### CA-04 — Cadastro de pesquisa

- **Dado** um coordenador
- **Quando** cria uma pesquisa de avaliação municipal para Itapetinga e Itambé, de 10 a 20/11, meta 600, GPS obrigatório
- **Então** ela aparece na lista em rascunho com esses dados

### CA-05 — Dados do TSE só onde cabem

- **Dado** uma pesquisa eleitoral registrada com número `BA-01234/2026`, estatístico e valor
- **Quando** o tipo muda para opinião pública (ou o registro é desmarcado)
- **Então** os dados do TSE são apagados; número fora do formato é recusado

### CA-06 — Regras de período e município

- **Dado** fim de campo antes do início, um código que não é de município do IBGE ou um município repetido
- **Quando** enviados
- **Então** são recusados apontando o campo

### CA-06b — Município de outro estado (alteração 1)

- **Dado** uma pesquisa em Itapetinga (BA) e Montes Claros (MG)
- **Quando** o coordenador troca a UF no seletor e escolhe o município de Minas
- **Então** a pesquisa guarda os dois, e o de fora da Bahia aparece como "Montes Claros (MG)"

### CA-07 — Arquivar, desarquivar, excluir

- **Dado** uma pesquisa em rascunho
- **Quando** é arquivada
- **Então** some da lista padrão, aparece no filtro de arquivadas, não aceita edição nem exclusão (`SURVEY_NOT_EDITABLE`) e, desarquivada, volta a rascunho e pode ser excluída

### CA-08 — Duplicar

- **Dado** uma pesquisa eleitoral registrada com período e número do TSE
- **Quando** duplicada
- **Então** a cópia está em rascunho, chama "Cópia de …", mantém tipo, municípios e estatístico, e não tem período nem número do TSE

### CA-09 — Isolamento e permissão

- **Dado** duas organizações
- **Quando** uma tenta ler, editar ou usar como cliente um registro da outra
- **Então** recebe "não encontrado"; analista, cliente e pesquisador recebem 403 em todas as rotas desta spec

### CA-10 — Painel

- **Dado** um coordenador no painel
- **Quando** cadastra cliente e pesquisa pelas telas Clientes e Pesquisas
- **Então** os dois aparecem nas listas (teste de ponta a ponta)

## Alterações

1. **2026-11-06 — municípios de qualquer estado** (pedido do Matheus: a empresa já fez pesquisas no norte de Minas, perto da divisa). Em vez de digitar o nome à mão, o seletor ganhou a escolha da UF e usa a lista completa do IBGE, para manter o código oficial de cada município (necessário para população, mapas e ponderação nos resultados). Migração `0006` troca a checagem do banco de "só Bahia" para "código de município do Brasil".

## Fora de escopo

- Questionário e sua cópia na duplicação (014).
- Publicação, "em campo", "encerrada", obrigatoriedade dos dados do TSE e trava do questionário eleitoral registrado (015).
- Atribuição a pesquisadores e aparelhos (016).
- Restringir coordenador/analista a pesquisas específicas (F2).
- Logo do cliente e identidade visual de relatórios (F2).
