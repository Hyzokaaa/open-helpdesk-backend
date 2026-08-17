import { Controller, Get, Inject, NotFoundException, Query } from '@nestjs/common';
import { Public } from '../../../../shared/nest/decorators/public.decorator';
import { TypeOrmWorkspaceRepository } from '../../typeorm/repositories/typeorm-workspace.repository';
import { S3StorageService } from '../../../../shared/infrastructure/s3-storage.service';

@Controller('internal')
export class DomainCheckController {
  constructor(
    @Inject() private readonly workspaceRepository: TypeOrmWorkspaceRepository,
    @Inject() private readonly s3Storage: S3StorageService,
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
  @Get('default-workspace')
  async defaultWorkspace() {
    const all = await this.workspaceRepository.findAll();
    if (all.length !== 1) throw new NotFoundException();
    return { slug: all[0].slug, name: all[0].name };
  }

  @Public()
  @Get('resolve-domain')
  async resolveDomain(@Query('host') host: string) {
    if (!host) throw new NotFoundException();

    const workspaces = await this.workspaceRepository.findByCustomDomain(host.toLowerCase());
    const verified = workspaces.filter((w) => w.customDomainVerified);
    if (verified.length === 0) throw new NotFoundException();

    const workspaceData = await Promise.all(
      verified.map(async (w) => ({
        slug: w.slug,
        name: w.name,
        palette: w.palette,
        appName: w.appName,
        appSubtitle: w.appSubtitle,
        logo: w.logo ? await this.s3Storage.getPresignedUrl(w.logo) : null,
      })),
    );

    return { workspaces: workspaceData };
  }
}
