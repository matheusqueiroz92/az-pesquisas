// Types for settings.mjs (plain JS so `node e2e/prepare.mjs` runs without a TS loader).
export declare const ADMIN_URL: string;
export declare const DATABASE: string;
export declare const OWNER_PASSWORD: string;
export declare const APP_PASSWORD: string;
export declare const API_PORT: number;
export declare const WEB_PORT: number;
export declare const API_URL: string;
export declare const WEB_URL: string;
export declare const JWT_SECRET: string;
export declare const MAIL_DIR: string;
export declare const DATABASE_ADMIN_URL: string;
export declare const DATABASE_OWNER_URL: string;
export declare const DATABASE_APP_URL: string;
export declare const ORGS: readonly {
  readonly name: string;
  readonly slug: string;
  readonly adminName: string;
  readonly adminEmail: string;
  readonly adminPassword: string;
}[];
