import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmWorkspaceRepository } from '../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';

@Injectable()
export class WorkspaceFrontendResolver {
  private readonly frontendUrl: string;

  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');
  }

  async resolve(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (workspace?.customDomain && workspace.customDomainVerified) {
      return `https://${workspace.customDomain}`;
    }
    return this.frontendUrl;
  }
}
