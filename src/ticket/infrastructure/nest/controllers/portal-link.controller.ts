import { Controller, Get, Inject, Param } from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { TypeOrmWorkspaceRepository } from '../../../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { TypeOrmTicketRepository } from '../../typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmTicketPortalAccessRepository } from '../../typeorm/repositories/typeorm-ticket-portal-access.repository';
import { ResolveOwnTicketPortalAccess } from '../../../domain/services/ticket-portal-access-resolve-own';

/** Portal links opened by someone signed in: while the portal is closed they lead to the dashboard */
@Controller('portal-links')
export class PortalLinkController {
  constructor(
    @Inject() private readonly portalAccessRepository: TypeOrmTicketPortalAccessRepository,
    @Inject() private readonly ticketRepository: TypeOrmTicketRepository,
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
  ) {}

  /** The ticket an own link opens; the dashboard then checks access as for any other ticket */
  @Get(':token')
  resolve(@Param('token') token: string, @CurrentUser() user: AuthUser) {
    const service = new ResolveOwnTicketPortalAccess(this.portalAccessRepository, this.ticketRepository, this.workspaceRepository);
    return service.execute({ token, userId: user.userId });
  }
}
