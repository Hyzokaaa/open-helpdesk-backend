export const CSAT_SURVEY_GUARD = 'CSAT_SURVEY_GUARD';

export interface CsatSurveyGuard {
  canSendSurvey(workspaceSlug: string): Promise<boolean>;
}
