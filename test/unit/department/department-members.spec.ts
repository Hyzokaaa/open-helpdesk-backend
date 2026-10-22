import { Department } from '../../../src/department/domain/entities/department';
import { DepartmentMember } from '../../../src/department/domain/entities/department-member';
import { SetDepartmentMembers } from '../../../src/department/domain/services/department-members-set';
import { AddDepartmentMember } from '../../../src/department/domain/services/department-member-add';
import { CreateDepartment } from '../../../src/department/domain/services/department-create';
import { CreateDepartmentCommand } from '../../../src/department/application/commands/create-department.command';
import { SetDepartmentMembersCommand } from '../../../src/department/application/commands/set-department-members.command';
import { ListDepartmentsQuery } from '../../../src/department/application/queries/list-departments.query';
import { WorkspaceMember } from '../../../src/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../../src/workspace/domain/enums/workspace-role.enum';
import { EnsureWorkspacePermission } from '../../../src/workspace/domain/services/workspace-ensure-permission';
import { AccessDeniedError, ConflictError, DomainValidationError, EntityNotFoundError } from '../../../src/shared/domain/errors';
import { FakeIdGenerator } from '../../mocks/fake-id-generator';
import { MockDepartmentMemberRepository, MockDepartmentRepository } from '../../mocks/mock-department.repository';
import { MockWorkspaceMemberRepository } from '../../mocks/mock-workspace-member.repository';

const WS = 'ws-1';

describe('Department agents', () => {
  let departments: MockDepartmentRepository;
  let deptMembers: MockDepartmentMemberRepository;
  let wsMembers: MockWorkspaceMemberRepository;
  let setMembers: SetDepartmentMembers;

  const member = (userId: string, role: WorkspaceRole, workspaceId = WS) =>
    wsMembers.seed(new WorkspaceMember({ id: `m-${userId}`, workspaceId, userId, role }));
  const agentsOf = async (departmentId: string) => (await deptMembers.findByDepartmentId(departmentId)).map((m) => m.userId).sort();

  beforeEach(() => {
    departments = new MockDepartmentRepository();
    deptMembers = new MockDepartmentMemberRepository();
    wsMembers = new MockWorkspaceMemberRepository();
    setMembers = new SetDepartmentMembers(new FakeIdGenerator('dm'), deptMembers, departments, wsMembers);
    departments.departments.push(new Department({ id: 'd1', name: 'Support', description: null, workspaceId: WS }));
    member('admin', WorkspaceRole.ADMIN);
    member('sup', WorkspaceRole.SUPERVISOR);
    member('agent', WorkspaceRole.AGENT);
    member('agent2', WorkspaceRole.AGENT);
    member('customer', WorkspaceRole.USER);
    member('outsider', WorkspaceRole.AGENT, 'ws-2');
  });

  it('replaces the list: adds who is missing and takes out who is no longer there', async () => {
    await deptMembers.create(new DepartmentMember({ id: 'x1', departmentId: 'd1', userId: 'agent' }));
    const change = await setMembers.execute({ departmentId: 'd1', workspaceId: WS, userIds: ['sup', 'agent2', 'agent2'] });
    expect(change).toEqual({ added: ['sup', 'agent2'], removed: ['agent'] });
    expect(await agentsOf('d1')).toEqual(['agent2', 'sup']);
    // Sending the same list again changes nothing
    expect(await setMembers.execute({ departmentId: 'd1', workspaceId: WS, userIds: ['sup', 'agent2'] })).toEqual({ added: [], removed: [] });
  });

  it('refuses the User role and people of other workspaces, and then writes nothing', async () => {
    await expect(setMembers.execute({ departmentId: 'd1', workspaceId: WS, userIds: ['agent', 'customer'] })).rejects.toThrow(DomainValidationError);
    await expect(setMembers.execute({ departmentId: 'd1', workspaceId: WS, userIds: ['agent', 'outsider'] })).rejects.toThrow(EntityNotFoundError);
    expect(await agentsOf('d1')).toEqual([]);
  });

  it('keeps someone already in it whose role changed since, until taken out', async () => {
    await deptMembers.create(new DepartmentMember({ id: 'x1', departmentId: 'd1', userId: 'customer' }));
    expect(await setMembers.execute({ departmentId: 'd1', workspaceId: WS, userIds: ['customer', 'agent'] })).toEqual({ added: ['agent'], removed: [] });
  });

  it('does not touch a department of another workspace', async () => {
    await expect(setMembers.execute({ departmentId: 'd1', workspaceId: 'ws-2', userIds: [] })).rejects.toThrow(EntityNotFoundError);
  });

  it('only those who manage departments can change the agents', async () => {
    const command = new SetDepartmentMembersCommand(setMembers, new EnsureWorkspacePermission(wsMembers));
    await expect(command.execute({ departmentId: 'd1', userIds: ['agent'], workspaceId: WS, currentUserId: 'agent', isSystemAdmin: false }))
      .rejects.toThrow(AccessDeniedError);
    await command.execute({ departmentId: 'd1', userIds: ['agent'], workspaceId: WS, currentUserId: 'admin', isSystemAdmin: false });
    expect(await agentsOf('d1')).toEqual(['agent']);
  });

  it('creates a department with its agents, or not at all when one cannot be in it', async () => {
    const command = new CreateDepartmentCommand(
      new CreateDepartment(new FakeIdGenerator('dep'), departments), new EnsureWorkspacePermission(wsMembers), setMembers,
    );
    const created = await command.execute({ name: 'Servers', description: null, memberUserIds: ['agent', 'sup'], workspaceId: WS, userId: 'admin', isSystemAdmin: false });
    expect(created.memberUserIds).toEqual(['agent', 'sup']);
    expect(await agentsOf(created.id)).toEqual(['agent', 'sup']);

    const before = departments.departments.length;
    await expect(command.execute({ name: 'Bad', description: null, memberUserIds: ['customer'], workspaceId: WS, userId: 'admin', isSystemAdmin: false }))
      .rejects.toThrow(DomainValidationError);
    expect(departments.departments.length).toBe(before);
  });

  it('adding one at a time also refuses the User role and a repeat', async () => {
    const add = new AddDepartmentMember(new FakeIdGenerator('dm'), deptMembers, departments, wsMembers);
    await add.execute({ departmentId: 'd1', userId: 'agent', workspaceId: WS });
    await expect(add.execute({ departmentId: 'd1', userId: 'agent', workspaceId: WS })).rejects.toThrow(ConflictError);
    await expect(add.execute({ departmentId: 'd1', userId: 'customer', workspaceId: WS })).rejects.toThrow(DomainValidationError);
  });

  it('the list says who is in each department and whether the caller is', async () => {
    await deptMembers.create(new DepartmentMember({ id: 'x1', departmentId: 'd1', userId: 'agent' }));
    const users = { findById: async (id: string) => ({ firstName: id.toUpperCase(), lastName: 'X' }) };
    const query = new ListDepartmentsQuery(departments, deptMembers, new EnsureWorkspacePermission(wsMembers), users as never);
    const [asAgent] = await query.execute({ workspaceId: WS, userId: 'agent', isSystemAdmin: false });
    expect(asAgent).toMatchObject({ memberCount: 1, isMember: true, members: [{ userId: 'agent', firstName: 'AGENT', lastName: 'X' }] });
    const [asAdmin] = await query.execute({ workspaceId: WS, userId: 'admin', isSystemAdmin: false });
    expect(asAdmin.isMember).toBe(false);
  });
});
