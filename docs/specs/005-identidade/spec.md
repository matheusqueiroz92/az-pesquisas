# Spec 005 — Identidade e acesso

- Status: concluída
- Fase: F0
- Aprovada por: Matheus (backlog da F0, 2026-11-04)

## Contexto

Antes de qualquer pesquisa, o sistema precisa saber quem está usando, de qual organização, e o que essa pessoa pode fazer. Fundação técnica › Segurança (autenticação no painel, autorização, matriz de permissões) e Multiempresa. O app de campo autentica pesquisadores por PIN e aparelho; isso entra na F1, com a vinculação de dispositivos.

## Regras

### Usuários e papéis

1. Todo usuário pertence a exatamente uma organização e tem um papel: `admin`, `coordinator`, `analyst`, `client` ou `interviewer`.
2. E-mail é único em todo o sistema (é a chave do login) e guardado em minúsculas, sem espaços nas pontas.
3. Usuário pode estar `active` ou `disabled`. Usuário desativado não faz login, e suas sessões são revogadas.
4. A matriz de permissões fica em `packages/contracts` e é a única fonte usada pela API (e, na spec 007, pelo painel).
5. Só quem tem a permissão `users.manage` (admin) cria, edita, desativa e lista usuários, e sempre da própria organização.
6. Um admin não pode desativar a si mesmo nem rebaixar o próprio papel, para não deixar a organização sem administrador por engano.

### Login e sessão

7. Login com e-mail e senha. Senhas com Argon2id; mínimo de 10 caracteres e no máximo 128.
8. Resposta de falha é sempre a mesma (`INVALID_CREDENTIALS`), exista ou não o e-mail, esteja a conta bloqueada ou desativada. Um e-mail inexistente custa o mesmo tempo que uma senha errada.
9. 5 senhas erradas seguidas bloqueiam a conta por 15 minutos. Um login certo zera o contador.
10. Login bem-sucedido devolve um **access token** (JWT, 15 min) e um **refresh token** (opaco, 256 bits, 30 dias). No banco fica só o hash SHA-256 do refresh token.
11. Cada uso do refresh token gera um novo par e invalida o anterior (rotação). Reusar um refresh token já trocado revoga a sessão inteira (sinal de roubo).
12. Logout revoga a sessão.
13. Limite de 10 tentativas de login por minuto por IP.

### Senha

14. "Esqueci a senha": a resposta é sempre 202, exista ou não o e-mail. Se existir e estiver ativo, gera um link de uso único válido por 30 minutos.
15. Redefinir a senha pelo link troca a senha, invalida o link e revoga todas as sessões do usuário.
16. Usuário logado troca a própria senha informando a atual; as outras sessões são revogadas.

### Auditoria

17. Ficam registrados, por organização: login com sucesso, login com falha (para e-mail existente), bloqueio de conta, reuso de refresh token, pedido e conclusão de redefinição de senha, troca de senha, criação e alteração de usuário.
18. O log de auditoria só aceita inserção: o usuário de banco da API não pode alterar nem apagar registros.

### Primeira organização

19. Não existe cadastro público. A primeira organização e seu admin são criados por um comando (`pnpm seed:admin`).

## Critérios de aceite

### CA-01 — Login e acesso

- **Dado** um usuário ativo
- **Quando** faz login com e-mail (em qualquer caixa) e senha corretos
- **Então** recebe access e refresh token, e `GET /v1/auth/me` com o access token devolve seus dados

### CA-02 — Falha indistinguível

- **Dado** um e-mail inexistente, uma senha errada, uma conta desativada e uma conta bloqueada
- **Quando** cada um tenta login
- **Então** todos recebem 401 com `code: "INVALID_CREDENTIALS"`

### CA-03 — Bloqueio

- **Dado** 5 senhas erradas seguidas
- **Quando** o usuário tenta de novo, mesmo com a senha certa
- **Então** é recusado até passarem 15 minutos; depois disso, entra

### CA-04 — Rotação e reuso

- **Dado** um refresh token usado uma vez
- **Quando** alguém o usa de novo
- **Então** recebe 401 e o refresh token novo (o legítimo) também deixa de funcionar

### CA-05 — Logout

- **Dado** um usuário logado
- **Quando** faz logout
- **Então** o refresh token deixa de funcionar

### CA-06 — Redefinição de senha

- **Dado** um pedido de redefinição para um e-mail existente
- **Quando** o link é usado com uma senha nova válida
- **Então** a senha muda, o link não funciona uma segunda vez e as sessões anteriores são revogadas; um link vencido é recusado

### CA-07 — Permissões

- **Dado** um coordenador, um analista, um cliente e um pesquisador
- **Quando** tentam listar ou criar usuários
- **Então** recebem 403 com `code: "FORBIDDEN"`; sem token, 401 com `code: "UNAUTHENTICATED"`

### CA-08 — Isolamento entre organizações

- **Dado** os admins das organizações A e B
- **Quando** o admin de A lista, consulta ou altera usuários
- **Então** só enxerga usuários de A; consultar ou alterar um usuário de B responde 404

### CA-09 — Validação

- **Dado** um corpo inválido (e-mail mal formado, senha curta, papel inexistente)
- **Quando** enviado
- **Então** 400 com `code: "VALIDATION_FAILED"` e a lista de campos inválidos, sem ecoar os valores enviados

### CA-10 — Auditoria imutável

- **Dado** registros de auditoria
- **Quando** o usuário de banco da API tenta alterar ou apagar um registro
- **Então** o banco recusa

## Fora de escopo

- Login do pesquisador no app (PIN + aparelho): F1.
- Envio real de e-mail (SMTP): o envio passa por uma porta `Mailer`; nesta spec, os e-mails são gravados em arquivo no ambiente local. O adaptador SMTP entra antes do primeiro uso real (spec 010).
- 2FA: F3.
- Escopo por pesquisa (coordenador só nas pesquisas dele, cliente só nas suas): F1, quando existirem pesquisas.
