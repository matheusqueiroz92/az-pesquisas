// Every table of every context, for drizzle-kit and for the typed client.
// A new context adds one line here.
export { organizations, passwordResets, sessions, users } from '../../modules/identity/index.js';
export { auditLogs } from '../audit/schema.js';
export {
  clients,
  questionnaireDrafts,
  questionnaireVersions,
  surveys,
} from '../../modules/surveys/index.js';
export {
  devicePairings,
  devices,
  surveyDevices,
  surveyInterviewers,
} from '../../modules/devices/index.js';
export { outboxEvents } from '../outbox/schema.js';
