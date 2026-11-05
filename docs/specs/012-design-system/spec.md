# Spec 012 — Design system do AZ Pesquisas

- Status: implementada (aguardando revisão)
- Fase: F0 (feita antes da 008, para o app já nascer com a identidade)
- Aprovada por: Matheus (2026-11-04)

## Contexto

As telas da spec 007 funcionam, mas não têm identidade. O AZ Pesquisas é um produto da AZ Work Center e deve parecer da família: a base é o manual da marca e o design system do site (`az-work-center-site-blueprint/docs/03-manual-da-marca.md` e `04-design-system.md`), adaptados a um sistema de trabalho diário — tabelas, formulários, gráficos e uso em tablet.

## Decisões de Matheus

1. **Direção visual**: conteúdo claro (papel quente `#F4F1EB` e branco) com menu lateral grafite; vermelho AZ só como pulso (ação principal, item ativo, foco).
2. **Marca**: símbolo AZ (vetorizado do PNG oficial) + "Pesquisas" em Manrope; "um produto AZ Work Center" como assinatura. Provisório até existirem os vetores oficiais (P-001 do site).

## Regras

1. Uma fonte de verdade: `packages/design-tokens`. O painel (Tailwind 4) e o app (spec 008) leem dela; um teste garante que o CSS e o objeto TypeScript têm os mesmos valores.
2. Componentes usam **tokens semânticos** (`bg-surface`, `text-muted-foreground`, `bg-primary`), nunca hex nem as cores padrão do Tailwind (a paleta padrão é removida).
3. Tipografia: Manrope (interface), IBM Plex Mono (números e códigos: contagens, ids, datas em tabela), Newsreader só em momentos editoriais (tela de login). Fontes servidas pelo próprio painel (sem Google Fonts, por causa da CSP e da privacidade).
4. Contraste AA em todo texto; alvo de toque de 44 px (tablets de campo); foco visível em vermelho 700; respeitar `prefers-reduced-motion`.
5. Gráficos (F1): paleta categórica de 8 cores em ordem fixa, validada para daltonismo nos modos claro e escuro; cinza neutro reservado para "Não sabe / Não respondeu / Outros"; cores de status nunca usadas como série.

## Critérios de aceite

- CA-01: o painel usa só tokens do pacote (nenhuma classe `slate-*`, `red-*` etc. do Tailwind padrão no código).
- CA-02: login, início, usuários e minha conta seguem a direção aprovada; os e2e da 007 continuam passando.
- CA-03: a paleta de gráficos passa no validador de daltonismo (adjacentes, modos claro e escuro).
- CA-04: referência navegável do design system publicada para consulta (cores, tipografia, componentes, marca).

## Fora de escopo

- Tema escuro do painel inteiro (os tokens já trazem os valores escuros, usados no menu e no app).
- Logo definitivo do AZ Pesquisas e favicon redesenhado para 16 px.
