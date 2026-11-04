# ADR-0010 — Três ambientes: local, homologação e produção

- Status: aceita
- Data: 2026-11-03

## Contexto

Uma falha no app descoberta em campo custa uma pesquisa. É preciso testar com os tablets reais antes de liberar.

## Decisão

- Local: Docker Compose com banco semeado.
- Homologação e produção no VPS Hostinger, atrás do Traefik, com bancos, domínios e segredos separados.
- Todo merge na `main` vai para homologação; produção recebe a mesma imagem, com aprovação manual.

## Consequências

- Dados reais existem só em produção.
- O app tem builds por ambiente (`development`, `preview`, `production`) apontando para a API correspondente.
