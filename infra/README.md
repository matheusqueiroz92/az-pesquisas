# infra

Arquivos de infraestrutura, criados nas specs 004 (banco local) e 010 (homologação e produção):

- `db/` — bootstrap do Postgres (usuários `az_owner`/`az_app`, PostGIS, privilégios). Usado pelo Compose, pelos testes e, na spec 010, pelos servidores
- `compose/` — Docker Compose de cada ambiente (`docker-compose.local.yml` pronto)
- `scripts/` — backup, restauração e seed
