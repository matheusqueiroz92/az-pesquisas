export interface Mailer {
  send(message: { to: string; subject: string; text: string }): Promise<void>;
}

export const MAILER = Symbol('MAILER');
