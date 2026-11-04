# ADR-0002 — API em NestJS com adaptador Fastify

- Status: aceita
- Data: 2026-11-03

## Contexto

A API é um monólito modular com seis contextos delimitados e arquitetura hexagonal. Duas pessoas e vários agentes de IA vão trabalhar no mesmo código; estrutura previsível vale mais que liberdade.

## Decisão

Usar NestJS com `@nestjs/platform-fastify`.

- Módulos do Nest espelham os contextos (`identity`, `surveys`, `devices`, `fieldwork`, `analytics`, `reporting`).
- Injeção de dependência liga portas (interfaces do domínio) a adaptadores (infraestrutura).
- Guards, interceptors, Swagger e integração com BullMQ vêm prontos.

## Condições

1. `domain/` e `application/` não importam nada de `@nestjs/*` (verificado pelo dependency-cruiser).
2. Só bibliotecas compatíveis com Fastify: `@fastify/helmet`, `@fastify/cookie`, `@fastify/multipart`, `@nestjs/throttler`. Middlewares exclusivos de Express são proibidos.

## Consequências

- O domínio é testável sem subir o framework.
- O ganho de desempenho do Fastify é secundário no volume atual (5 tablets); o motivo principal da escolha é a estrutura.
