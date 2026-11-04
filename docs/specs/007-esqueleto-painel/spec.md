# Spec 007 — Esqueleto do painel web

- Status: implementada (aguardando revisão)
- Fase: F0
- Aprovada por: Matheus (backlog da F0, 2026-11-04)

## Contexto

O painel é onde coordenadores, analistas e administradores vão trabalhar. Esta spec entrega a base de todas as telas futuras: login, sessão segura, layout com navegação por permissão, gestão de usuários e as telas de senha. Fundação técnica › Arquitetura › Painel web; Segurança › Autenticação no painel; spec 005.

## Regras

### Sessão (BFF)

1. O navegador **nunca** vê os tokens. O servidor do painel (Next.js) faz login na API e guarda os tokens em cookies `httpOnly`, `SameSite=Lax` e `Secure` fora do ambiente local.
2. O cookie do access token expira junto com o token (15 min). O cookie do refresh token vale 30 dias. Nenhum dos dois pode ser lido por JavaScript (`httpOnly`).
3. Quando o access token vence e há refresh token, o painel renova antes de carregar a página, sem o usuário perceber.
4. **Uma renovação por vez**: pedidos simultâneos com o mesmo refresh token (várias abas, várias chamadas da mesma tela) esperam a mesma renovação. Um pedido que chega logo depois com o token recém-trocado (até 30 segundos) recebe o resultado já obtido. Assim, abrir várias abas nunca derruba a sessão (risco registrado no design da spec 005).
5. Renovação recusada pela API (sessão revogada, usuário desativado): os cookies são apagados e a pessoa volta para o login.
6. O navegador fala com a API só através do painel (`/api/...`). Rotas que mudam dados recusam requisições de outra origem.

### Telas

7. **Login** (`/login`): e-mail e senha. Erro sempre genérico, com a dica "se você errou a senha várias vezes, aguarde 15 minutos".
8. **Esqueci a senha** (`/esqueci-senha`) e **redefinir senha** (`/redefinir-senha?token=...`, o link do e-mail).
9. **Início** (`/`): saudação e atalhos.
10. **Usuários** (`/usuarios`), só para quem tem `users.manage`: lista com nome, e-mail, papel, situação e último acesso; criar usuário; editar nome, papel e situação.
11. **Minha conta** (`/minha-conta`): dados do usuário e troca de senha.
12. Menu lateral mostra só o que o papel permite (matriz de `packages/contracts`). Acessar a URL de uma tela sem permissão mostra "Sem permissão", e a API recusa de qualquer forma.
13. Todos os textos em português, num arquivo de tradução; códigos de erro da API traduzidos.

### Segurança das páginas

14. Content-Security-Policy com nonce por requisição: só scripts do próprio painel executam.
15. Cabeçalhos: `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`.

## Critérios de aceite

### CA-01 — Rotas protegidas

- **Dado** uma pessoa sem sessão
- **Quando** abre `/` ou `/usuarios`
- **Então** vai para `/login`

### CA-02 — Login

- **Dado** o admin
- **Quando** entra com e-mail e senha corretos
- **Então** vê o início com o próprio nome; com senha errada, vê a mensagem genérica e continua no login

### CA-03 — Tokens fora do alcance do JavaScript

- **Dado** uma sessão ativa
- **Quando** se inspecionam os cookies
- **Então** os dois cookies de token são `httpOnly` e `SameSite=Lax`, e nenhum token aparece no HTML da página

### CA-04 — Várias abas ao mesmo tempo

- **Dado** uma sessão com o access token vencido
- **Quando** três abas abrem páginas ao mesmo tempo
- **Então** as três carregam logadas, e a sessão continua válida depois disso

### CA-05 — Gestão de usuários

- **Dado** o admin em `/usuarios`
- **Quando** cria um coordenador e depois o desativa
- **Então** o coordenador aparece na lista, e depois de desativado não consegue mais entrar

### CA-06 — Menu e acesso por papel

- **Dado** um coordenador logado
- **Quando** olha o menu e tenta abrir `/usuarios`
- **Então** o menu não mostra "Usuários" e a página mostra "Sem permissão"

### CA-07 — Senha

- **Dado** um pedido de "esqueci a senha"
- **Quando** o link do e-mail é aberto e uma senha nova é definida
- **Então** a pessoa entra com a senha nova; e em "Minha conta", trocar a senha com a senha atual errada mostra o erro

### CA-08 — Sair

- **Dado** uma sessão ativa
- **Quando** clica em "Sair"
- **Então** volta ao login, e voltar para `/` pede login de novo

### CA-09 — Cabeçalhos de segurança

- **Dado** qualquer página
- **Quando** é carregada
- **Então** tem CSP com nonce e os cabeçalhos da regra 15

## Fora de escopo

- Área do cliente (perfil Cliente vendo resultados): F2.
- Telas de pesquisas, dispositivos e resultados: F1.
- Tema escuro e identidade visual definitiva da AZ Pesquisas.
