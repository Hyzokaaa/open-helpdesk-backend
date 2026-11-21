import { NoticeKind } from './notice-kind';

/** Someone joined a workspace's team (admin, supervisor or agent): by invitation, added or imported. */
export const MEMBER_JOINED_NOTICE: NoticeKind = {
  key: 'member-joined',
  audience: 'workspace-admins',
  label: { en: 'New team member', es: 'Nuevo miembro' },
  description: {
    en: 'Someone joins the team of a workspace you administer. Customers are left out.',
    es: 'Alguien entra en el equipo de un workspace que administras. Los clientes no cuentan.',
  },
  // Who comes first: it is what the bell and the subject line can still show when cut short
  headline: { en: '{who} {joined} the {workspace} team', es: '{who} {joined} al equipo de {workspace}' },
  action: { en: 'See the team', es: 'Ver el equipo' },
  icon: '👋',
  defaults: { inApp: true, email: true, matrix: true },
};

export const CORE_NOTICE_KINDS: NoticeKind[] = [MEMBER_JOINED_NOTICE];
