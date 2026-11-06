// Every table of every context, for drizzle-kit and for the typed client.
// A new context adds one line here.
export { organizations, passwordResets, sessions, users } from '../../modules/identity/index.js';
export { auditLogs } from '../audit/schema.js';
export { clients, surveys } from '../../modules/surveys/index.js';
export { outboxEvents } from '../outbox/schema.js';
