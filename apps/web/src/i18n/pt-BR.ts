import type { ErrorCode, Role, UserStatus } from '@az-pesquisas/contracts';

/** Every text of the panel (ADR-0001: interface in pt-BR, centralized). */
export const t = {
  app: {
    name: 'AZ Pesquisas',
    tagline: 'Painel de pesquisas de campo',
  },
  nav: {
    home: 'Início',
    users: 'Usuários',
    account: 'Minha conta',
    logout: 'Sair',
  },
  login: {
    title: 'Entrar no painel',
    email: 'E-mail',
    password: 'Senha',
    submit: 'Entrar',
    submitting: 'Entrando…',
    forgot: 'Esqueci a senha',
    lockoutHint: 'Se você errou a senha várias vezes, aguarde 15 minutos antes de tentar de novo.',
  },
  forgot: {
    title: 'Esqueci a senha',
    intro:
      'Informe seu e-mail. Se ele estiver cadastrado, enviaremos um link para criar uma senha nova.',
    submit: 'Enviar link',
    sent: 'Se o e-mail estiver cadastrado, você receberá o link em instantes. Ele vale por 30 minutos.',
    back: 'Voltar para o login',
  },
  reset: {
    title: 'Criar senha nova',
    newPassword: 'Senha nova',
    confirm: 'Repita a senha nova',
    passwordHint: 'Mínimo de 10 caracteres.',
    submit: 'Salvar senha',
    mismatch: 'As senhas não são iguais.',
    done: 'Senha alterada. Entre com a senha nova.',
    missingToken: 'Link incompleto. Peça um novo em "Esqueci a senha".',
  },
  home: {
    greeting: (name: string) => `Olá, ${name.split(' ')[0] ?? name}!`,
    intro:
      'Este é o painel do AZ Pesquisas. As telas de pesquisas e dispositivos chegam na próxima fase.',
    yourRole: 'Seu papel',
  },
  users: {
    title: 'Usuários',
    intro: 'Pessoas com acesso ao painel e pesquisadores de campo da sua organização.',
    new: 'Novo usuário',
    name: 'Nome',
    email: 'E-mail',
    role: 'Papel',
    status: 'Situação',
    lastLogin: 'Último acesso',
    never: 'Nunca',
    actions: 'Ações',
    edit: 'Editar',
    initialPassword: 'Senha inicial',
    initialPasswordHint:
      'Mínimo de 10 caracteres. Combine com a pessoa uma forma segura de entregar.',
    save: 'Salvar',
    cancel: 'Cancelar',
    created: 'Usuário criado.',
    updated: 'Usuário atualizado.',
    empty: 'Nenhum usuário cadastrado.',
  },
  account: {
    title: 'Minha conta',
    changePassword: 'Trocar senha',
    currentPassword: 'Senha atual',
    newPassword: 'Senha nova',
    submit: 'Trocar senha',
    changed: 'Senha alterada. As outras sessões abertas foram encerradas.',
  },
  forbidden: {
    title: 'Sem permissão',
    body: 'Seu papel não permite acessar esta tela. Se precisar, fale com o administrador.',
  },
  roles: {
    admin: 'Administrador',
    coordinator: 'Coordenador',
    analyst: 'Analista',
    client: 'Cliente',
    interviewer: 'Pesquisador',
  } satisfies Record<Role, string>,
  statuses: {
    active: 'Ativo',
    disabled: 'Desativado',
  } satisfies Record<UserStatus, string>,
  errors: {
    generic: 'Algo deu errado. Tente de novo em instantes.',
  },
} as const;

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  BAD_REQUEST: 'A requisição está incorreta.',
  UNAUTHENTICATED: 'Sua sessão expirou. Entre novamente.',
  FORBIDDEN: 'Você não tem permissão para esta ação.',
  NOT_FOUND: 'Não encontrado.',
  METHOD_NOT_ALLOWED: 'Operação não permitida.',
  CONFLICT: 'Conflito com dados existentes.',
  PAYLOAD_TOO_LARGE: 'Os dados enviados são grandes demais.',
  UNSUPPORTED_MEDIA_TYPE: 'Formato de dados não suportado.',
  UNPROCESSABLE_ENTITY: 'Não foi possível processar os dados.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde um minuto e tente de novo.',
  INTERNAL_ERROR: 'Erro no servidor. Tente de novo em instantes.',
  SERVICE_UNAVAILABLE: 'Serviço indisponível no momento. Tente de novo em instantes.',
  HTTP_ERROR: 'Não foi possível completar a operação.',
  VALIDATION_FAILED: 'Confira os campos destacados.',
  INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
  INVALID_REFRESH_TOKEN: 'Sua sessão expirou. Entre novamente.',
  INVALID_RESET_TOKEN: 'Este link é inválido ou expirou. Peça um novo em "Esqueci a senha".',
  INVALID_CURRENT_PASSWORD: 'A senha atual está incorreta.',
  EMAIL_ALREADY_IN_USE: 'Este e-mail já está em uso.',
  USER_NOT_FOUND: 'Usuário não encontrado.',
  CANNOT_DISABLE_SELF: 'Você não pode desativar a sua própria conta.',
  CANNOT_DEMOTE_SELF: 'Você não pode mudar o seu próprio papel.',
};

const isErrorCode = (code: string): code is ErrorCode => code in ERROR_MESSAGES;

/** Translates an API error code; unknown codes get a generic message. */
export const errorMessage = (code: string | undefined): string =>
  code !== undefined && isErrorCode(code) ? ERROR_MESSAGES[code] : t.errors.generic;
