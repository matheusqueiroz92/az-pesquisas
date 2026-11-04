import { z } from 'zod';

/** E-mail as typed by a person: trimmed and lower-cased before validation (it is the login key). */
export const Email = z.string().trim().toLowerCase().max(254).pipe(z.email());

/** Policy for NEW passwords. Login accepts any length up to 128 (old passwords keep working). */
export const NewPassword = z.string().min(10).max(128);

/** Opaque random tokens (refresh, password reset): 32 bytes in base64url = 43 characters. */
export const OpaqueToken = z.string().min(32).max(200);

export const Id = z.uuid();

export const IsoDateTime = z.iso.datetime({ offset: true });
