// Public entry point of the identity context (AGENTS.md rule 4).
// Other contexts may import only from here.
export {
  auditLogs,
  organizations,
  passwordResets,
  sessions,
  users,
} from './infrastructure/schema.js';
