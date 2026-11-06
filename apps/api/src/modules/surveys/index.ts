// Public entry point of the surveys context (AGENTS.md rule 4).
// Other contexts may import only from here.
export {
  clients,
  questionnaireDrafts,
  questionnaireVersions,
  surveys,
} from './infrastructure/schema.js';
export { surveyDirectory } from './infrastructure/directory.js';
export type { SurveyRef } from './infrastructure/directory.js';
