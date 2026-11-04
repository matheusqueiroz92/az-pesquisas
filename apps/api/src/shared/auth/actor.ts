import type { Role } from '@az-pesquisas/contracts';

/** Who is acting, taken from the verified access token (never from the request body). */
export interface Actor {
  readonly userId: string;
  readonly organizationId: string;
  readonly role: Role;
  readonly sessionId: string;
}

/** Verifies an access token; implemented by the identity module (JWT). */
export interface AccessTokenVerifier {
  verify(token: string): Promise<Actor | undefined>;
}

export const ACCESS_TOKEN_VERIFIER = Symbol('ACCESS_TOKEN_VERIFIER');
