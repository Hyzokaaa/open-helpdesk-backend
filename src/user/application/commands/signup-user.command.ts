import { Command } from '../../../shared/domain/command';
import { TokenService } from '../../../shared/domain/token-service';
import { DomainValidationError, ConflictError } from '../../../shared/domain/errors';
import { CreateUser } from '../../domain/services/user-create';
import { CreateAccountForUser } from '../../../account/domain/services/account-create-for-user';
import { AcceptInvitation } from '../../../workspace/domain/services/invitation-accept';
import { WorkspaceInvitationRepository } from '../../../workspace/domain/repositories/workspace-invitation.repository';
import { InvitationStatus } from '../../../workspace/domain/enums/invitation-status.enum';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';

interface Props {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  invitationToken: string;
}

export interface SignupResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isEmailVerified: boolean;
  };
}

export class SignupUserCommand implements Command<Props, SignupResponse> {
  constructor(
    private readonly createUser: CreateUser,
    private readonly createAccount: CreateAccountForUser,
    private readonly acceptInvitation: AcceptInvitation,
    private readonly invitationRepository: WorkspaceInvitationRepository,
    private readonly tokenService: TokenService,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<SignupResponse> {
    const invitation = await this.invitationRepository.findByToken(props.invitationToken);
    if (!invitation || invitation.status !== InvitationStatus.PENDING) {
      throw new DomainValidationError('Invalid or expired invitation');
    }
    if (invitation.email !== props.email) {
      throw new DomainValidationError('Email does not match the invitation');
    }
    if (invitation.isExpired()) {
      throw new DomainValidationError('Invitation has expired');
    }

    let user;
    try {
      user = await this.createUser.execute({
        email: props.email,
        password: props.password,
        firstName: props.firstName,
        lastName: props.lastName,
        isEmailVerified: true,
      });
    } catch (err) {
      if (err instanceof ConflictError) throw new ConflictError('Email already registered');
      throw err;
    }

    await this.createAccount.execute({
      userId: user.getId(),
      firstName: props.firstName,
    });

    await this.acceptInvitation.execute({
      token: props.invitationToken,
      userId: user.getId(),
      userEmail: user.email,
    });

    const accessToken = this.tokenService.sign({
      sub: user.getId(),
      email: user.email,
      isSystemAdmin: user.isSystemAdmin,
    });

    await this.createAuditLog.execute({
      action: AuditAction.USER_SIGNED_UP,
      entityType: 'user',
      entityId: user.getId(),
      userId: user.getId(),
      workspaceId: invitation.workspaceId,
      metadata: { email: props.email, invitedToWorkspace: invitation.workspaceId },
    });

    return {
      accessToken,
      user: {
        id: user.getId(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: true,
      },
    };
  }
}
