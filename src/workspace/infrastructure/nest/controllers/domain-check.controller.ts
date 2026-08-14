import { Controller, Get, Inject, NotFoundException, Query } from '@nestjs/common';
import { Public } from '../../../../shared/nest/decorators/public.decorator';
import { TypeOrmWorkspaceRepository } from '../../typeorm/repositories/typeorm-workspace.repository';

@Controller('internal')
export class DomainCheckController {
  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
  ) {}

  @Public()
  @Get('check-domain')
  async checkDomain(@Query('domain') domain: string) {
    if (!domain) throw new NotFoundException();

    const workspaces = await this.workspaceRepository.findByCustomDomain(domain.toLowerCase());
    const verified = workspaces.filter((w) => w.customDomainVerified);
    if (verified.length === 0) throw new NotFoundException();

    return { ok: true };
  }

  @Public()
  @Get('resolve-domain')
  async resolveDomain(@Query('host') host: string) {
    if (!host) throw new NotFoundException();

    const workspaces = await this.workspaceRepository.findByCustomDomain(host.toLowerCase());
    const verified = workspaces.filter((w) => w.customDomainVerified);
    if (verified.length === 0) throw new NotFoundException();

    return {
      workspaces: verified.map((w) => ({
        slug: w.slug,
        name: w.name,
        palette: w.palette,
      })),
    };
  }
}
