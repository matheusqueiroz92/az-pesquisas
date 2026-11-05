# Spec 008 — Esqueleto do app de campo

- Status: implementada (aguardando revisão)
- Fase: F0
- Aprovada por: Matheus (2026-11-05)

## Contexto

O app roda nos tablets Android da empresa (um pesquisador por tablet) e, como reserva, nos iPhones da equipe. Ele aplica entrevistas **sem internet** e sincroniza depois (F1). Esta spec entrega a base: app Expo no monorepo, banco local criptografado, login do pesquisador, sessão que sobrevive dias offline e as primeiras telas com o design system (spec 012). ADR-0009; Fundação técnica › App.

## Decisões de Matheus

1. **Teste em aparelho via Android Studio** (emulador ou aparelho por cabo, `expo run:android`). O EAS fica para a spec 011.
2. **Quem entra no app**: Pesquisador e Coordenador. Admin, Analista e Cliente veem "Use o painel web" e a sessão é encerrada na hora.

## Regras

### Banco local

1. Banco SQLite criptografado com SQLCipher. Chave aleatória de 256 bits por instalação, gerada no primeiro uso e guardada no SecureStore (só acessível com o aparelho desbloqueado, nunca sai do aparelho, não vai para backup).
2. **Falha fechada**: se o binário não tiver SQLCipher (`PRAGMA cipher_version` vazio), o app não abre o banco e mostra erro. Nunca grava dados sem criptografia.
3. Migrações versionadas (`PRAGMA user_version`), aplicadas em transação na abertura. A F0 cria só a tabela de metadados da instalação (id da instalação, criado em).

### Sessão

4. O primeiro login precisa de internet: e-mail e senha vão para `POST /v1/auth/login` da API. Mensagens de erro iguais às do painel (genéricas, com a dica dos 15 minutos).
5. Tokens ficam no SecureStore, nunca no SQLite, em logs ou na tela.
6. **Offline**: com sessão salva, o app abre direto nas telas internas mesmo sem rede e mesmo com o access token vencido. Trabalho local não depende da API.
7. Renovação (`/v1/auth/refresh`) só quando houver rede e for preciso falar com a API; uma por vez (chamadas simultâneas esperam a mesma renovação, como no painel). Falha de rede não encerra a sessão.
8. Renovação **recusada** pela API (sessão revogada, usuário desativado, refresh vencido): tokens apagados, volta ao login. Os dados locais continuam no aparelho, criptografados.
9. Papel fora de Pesquisador/Coordenador: login recusado com mensagem clara e a sessão revogada na API.
10. Sair: revoga na API se houver rede (sem bloquear), apaga os tokens.

### Telas

11. **Entrar**: e-mail, senha, mensagem de erro e endereço do servidor visível (para suporte).
12. **Pesquisas**: lista vazia nesta fase ("Nenhuma pesquisa no aparelho. Elas aparecem aqui depois da sincronização.").
13. **Conta**: nome, papel, servidor, versão do app, situação do banco ("Criptografado") e Sair.
14. Textos em português num arquivo de tradução; cores, tipos e raios de `packages/design-tokens`. Alvo de toque mínimo de 44 px.

### Arquitetura

15. Camadas como na API: `domain` e `application` sem React, Expo ou rede (regra do dependency-cruiser); `infrastructure` implementa as portas; telas só falam com os casos de uso.
16. O endereço da API vem de `EXPO_PUBLIC_API_URL` no build (local: `http://10.0.2.2:3000`, o endereço do PC visto pelo emulador Android). HTTP sem TLS só no ambiente local.

## Critérios de aceite

- CA-01: com a API no ar, o pesquisador entra e vê "Pesquisas"; com senha errada, vê o erro genérico.
- CA-02: um admin tenta entrar e vê "Use o painel web"; a sessão dele é revogada.
- CA-03: depois de entrar, com o modo avião ligado, fechar e abrir o app leva direto a "Pesquisas".
- CA-04: com o usuário desativado no painel, ao voltar a internet a próxima renovação leva ao login.
- CA-05: "Conta" mostra o banco como criptografado; sem SQLCipher o app recusa abrir o banco (teste automático).
- CA-06: duas chamadas simultâneas com o token vencido fazem uma única renovação (teste automático).

## Fora de escopo

- Pesquisas, entrevistas, GPS, sincronização e vínculo de dispositivos (F1).
- Build na nuvem e distribuição pelas lojas (spec 011).
- Testes de interface automatizados no aparelho (Maestro/Detox): avaliados na F1, quando houver fluxo de entrevista.
