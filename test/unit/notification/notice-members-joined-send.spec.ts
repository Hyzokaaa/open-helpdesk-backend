import { SendMembersJoinedNotice } from '../../../src/notification/domain/services/notice-members-joined-send';
import { SendNoticeProps } from '../../../src/notification/domain/services/notice-send';
import { MEMBER_JOINED_NOTICE } from '../../../src/notification/domain/core-notice-kinds';
import { noticeText } from '../../../src/notification/domain/notice-kind';
import { User } from '../../../src/user/domain/entities/user';
import { Workspace } from '../../../src/workspace/domain/entities/workspace';
import { WorkspaceRole } from '../../../src/workspace/domain/enums/workspace-role.enum';
import { MockUserRepository } from '../../mocks/mock-user.repository';
import { MockWorkspaceRepository } from '../../mocks/mock-workspace.repository';

const user = (id: string, firstName: string, lastName = '') => new User({
  id, email: `${id}@acme.test`, password: 'hashed', firstName, lastName,
  isActive: true, isSystemAdmin: false, isEmailVerified: true, language: 'en', theme: 'system',
});

describe('Telling the admins who joined the team', () => {
  let sent: SendNoticeProps[];
  let users: MockUserRepository;
  let notice: SendMembersJoinedNotice;

  beforeEach(async () => {
    sent = [];
    users = new MockUserRepository();
    const workspaces = new MockWorkspaceRepository();
    await workspaces.create(new Workspace({ id: 'ws-1', name: 'Acme', slug: 'acme', description: '' }));
    for (const [id, name] of [['leo', 'Leo Ruiz'], ['mia', 'Mia Sol'], ['noa', 'Noa Paz'], ['ivo', 'Ivo Gil'], ['cli', 'Carla Cliente']]) {
      const [first, last] = name.split(' ');
      users.seed(user(id, first, last));
    }
    notice = new SendMembersJoinedNotice(
      { send: async (props: SendNoticeProps) => { sent.push(props); return { inApp: [], email: [], matrix: [] }; } },
      workspaces,
      users,
    );
  });

  it('names who joined and as what, in each language, and links to the team', async () => {
    await notice.execute({ workspaceId: 'ws-1', members: [{ userId: 'leo', role: WorkspaceRole.AGENT }], actorId: null });

    expect(sent).toEqual([{
      kind: 'member-joined',
      workspace: { id: 'ws-1', slug: 'acme' },
      exclude: ['leo'],
      data: { workspace: 'Acme', who: { en: 'Leo Ruiz (agent)', es: 'Leo Ruiz (agente)' }, joined: { en: 'joined', es: 'se unió' } },
      path: '/dashboard/workspaces/acme/members?joined=leo',
    }]);
    // Who comes first, so a line cut short still says it
    expect(noticeText(MEMBER_JOINED_NOTICE.headline, 'en', sent[0].data)).toBe('Leo Ruiz (agent) joined the Acme team');
    expect(noticeText(MEMBER_JOINED_NOTICE.headline, 'es', sent[0].data)).toBe('Leo Ruiz (agente) se unió al equipo de Acme');
  });

  it('is one notice for an import, naming the first three and counting the rest', async () => {
    await notice.execute({
      workspaceId: 'ws-1',
      members: [
        { userId: 'leo', role: WorkspaceRole.AGENT },
        { userId: 'mia', role: WorkspaceRole.SUPERVISOR },
        { userId: 'noa', role: WorkspaceRole.ADMIN },
        { userId: 'ivo', role: WorkspaceRole.AGENT },
      ],
      actorId: 'ana',
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].data.who).toEqual({
      en: 'Leo Ruiz (agent), Mia Sol (supervisor), Noa Paz (admin) and 1 more',
      es: 'Leo Ruiz (agente), Mia Sol (supervisor), Noa Paz (admin) y 1 más',
    });
    expect(sent[0].data.joined).toEqual({ en: 'joined', es: 'se unieron' });
    expect(noticeText(MEMBER_JOINED_NOTICE.headline, 'es', sent[0].data)).toBe('Leo Ruiz (agente), Mia Sol (supervisor), Noa Paz (admin) y 1 más se unieron al equipo de Acme');
    // Whoever imported them knows already, and those who joined do not hear of themselves
    expect(sent[0].exclude).toEqual(['ana', 'leo', 'mia', 'noa', 'ivo']);
    // The members page marks every one of them, not only those named
    expect(sent[0].path).toBe('/dashboard/workspaces/acme/members?joined=leo,mia,noa,ivo');
  });

  it('leaves customers out, and says nothing when only customers came in', async () => {
    await notice.execute({ workspaceId: 'ws-1', members: [{ userId: 'cli', role: WorkspaceRole.USER }], actorId: 'ana' });
    expect(sent).toEqual([]);

    await notice.execute({ workspaceId: 'ws-1', members: [{ userId: 'cli', role: WorkspaceRole.USER }, { userId: 'leo', role: WorkspaceRole.AGENT }], actorId: 'ana' });
    expect(sent[0].data.who).toEqual({ en: 'Leo Ruiz (agent)', es: 'Leo Ruiz (agente)' });
  });

  it('says nothing for a workspace that is gone', async () => {
    await notice.execute({ workspaceId: 'ws-gone', members: [{ userId: 'leo', role: WorkspaceRole.AGENT }], actorId: null });
    expect(sent).toEqual([]);
  });
});
