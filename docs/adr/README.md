# Decisões de arquitetura (ADRs)

Cada arquivo registra uma decisão que vale para todo o projeto. Uma decisão só muda por um ADR novo que a substitua (o antigo recebe status `substituída por ADR-XXXX`).

| ADR                                            | Decisão                                                 |
| ---------------------------------------------- | ------------------------------------------------------- |
| [0001](./0001-idioma.md)                       | Código em inglês; interface e documentação em português |
| [0002](./0002-nestjs-fastify.md)               | API em NestJS com adaptador Fastify                     |
| [0003](./0003-zod-fonte-unica-de-schemas.md)   | Zod como fonte única de schemas                         |
| [0004](./0004-postgresql-postgis-drizzle.md)   | PostgreSQL + PostGIS com Drizzle                        |
| [0005](./0005-multiempresa-com-rls.md)         | Multiempresa com isolamento na aplicação e RLS          |
| [0006](./0006-uuid-v7.md)                      | Identificadores UUID v7                                 |
| [0007](./0007-datas-em-utc.md)                 | Datas em UTC, exibição em America/Bahia                 |
| [0008](./0008-erros-como-valores.md)           | Erros de negócio como valores; Problem Details          |
| [0009](./0009-app-expo-sqlcipher.md)           | App em Expo com SQLite criptografado                    |
| [0010](./0010-tres-ambientes.md)               | Ambientes local, homologação e produção                 |
| [0011](./0011-versoes-de-ferramentas.md)       | TypeScript 6.0 e pnpm 10                                |
| [0012](./0012-validacao-zod-sem-nestjs-zod.md) | Validação com Zod sem `nestjs-zod` (pipe próprio)       |
| [0013](./0013-pnpm-node-linker-hoisted.md)     | `node_modules` plano no pnpm (build Android no Windows) |

Novo ADR: copie o formato de um existente, use o próximo número e adicione a linha nesta tabela.
