# Design 012 — Design system

## Pacote `@az-pesquisas/design-tokens`

| Arquivo                | Conteúdo                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/tokens.ts`        | Objeto tipado: primitivas da marca, semânticas (claro/escuro), tipografia, raios, gráficos. É o que o app Expo vai importar. |
| `theme.css`            | Bloco `@theme` do Tailwind 4 com os mesmos valores. Zera a paleta padrão do Tailwind.                                        |
| `src/tokens.test.ts`   | Garante que cada valor do `.ts` está no `.css` (as duas formas nunca divergem) e checa contraste AA dos pares texto/fundo.   |
| `assets/az-symbol.svg` | Símbolo AZ vetorizado (potrace a partir de `LOGO-AZ-WORK-CENTER-1.png`), `fill="currentColor"`.                              |

## Cores

| Papel                      | Token                              | Valor                                                                                              |
| -------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| Fundo da página            | `background`                       | Paper `#F4F1EB`                                                                                    |
| Cartões, tabelas, diálogos | `surface`                          | `#FFFFFF`                                                                                          |
| Texto                      | `foreground`                       | Carbon `#111317`                                                                                   |
| Texto de apoio             | `muted-foreground`                 | `#535861`                                                                                          |
| Bordas                     | `border` / `border-strong`         | `#DDD8CF` / `#C8C5BF`                                                                              |
| Ação principal             | `primary` / `primary-hover`        | Red 600 `#E21D2F` / Red 700 `#C9182B`                                                              |
| Menu lateral               | `sidebar`                          | Carbon `#111317`, texto Paper, apoio Mist `#A9B0BA`, destaque Red 500 `#EF233C`                    |
| Status                     | `success` `warning` `error` `info` | `#2F9E62` `#D97706` (texto `#A84A06`) `#D9363E` `#2563EB` (+ versões `-soft` para fundos de aviso) |

`warning` usa `#A84A06` como texto (o `#D97706` do site não passa AA sobre branco nem sobre o fundo de aviso); `#D97706` fica para ícones e marcas.

## Gráficos

Ordem fixa (claro / escuro): vermelho `#E21D2F`/`#EF233C`, azul `#2A78D6`/`#3987E5`, verde-água `#1BAF7A`/`#199E70`, laranja `#EB6834`/`#D95926`, violeta `#6250D6`/`#9085E9`, verde `#008300`/`#2F9E62`, âmbar `#EDA100`/`#C98500`, magenta `#E87BA4`/`#D55181`. Escolhida entre as 68 ordens (com vermelho primeiro) que passam todas as checagens nos dois modos; as 3 primeiras também passam em "todos os pares" (dispersão, mapas). Âmbar, verde-água e magenta ficam abaixo de 3:1 no branco: gráficos sempre com rótulo direto ou tabela. Cinza `#8B909A` = "Não sabe / Não respondeu / Outros".

## Painel

- Layout: menu grafite fixo à esquerda (desktop/tablet), barra superior com menu recolhível no celular.
- Item ativo do menu: barra vermelha de 3 px à esquerda (a "linha AZ") + texto claro.
- Login: tela dividida. À esquerda, campo escuro com o símbolo grande e uma frase editorial em Newsreader; à direita, o formulário sobre papel. No celular, só o formulário com a marca no topo.
- Números em tabelas e datas em IBM Plex Mono com `tabular-nums`.

## Referência navegável

Publicada como artefato "AZ Pesquisas — Design System": https://claude.ai/artifact/EeKrZ2RDttLTRtoHz2QHw8 (privado até ser compartilhado). Gerada a partir deste pacote; se divergir, vale o código.
