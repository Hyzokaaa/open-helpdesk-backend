import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemBranding } from '../../../domain/entities/system-branding';
import { SystemBrandingRepository } from '../../../domain/repositories/system-branding.repository';
import { SystemBrandingModel } from '../models/system-branding.model';

@Injectable()
export class TypeOrmSystemBrandingRepository implements SystemBrandingRepository {
  constructor(
    @InjectRepository(SystemBrandingModel)
    private readonly repository: Repository<SystemBrandingModel>,
  ) {}

  async find(): Promise<SystemBranding | null> {
    const model = await this.repository.findOne({ where: {} });
    if (!model) return null;
    return new SystemBranding({
      id: model.id,
      appName: model.appName,
      appSubtitle: model.appSubtitle,
      logo: model.logo,
    });
  }

  async save(branding: SystemBranding): Promise<void> {
    await this.repository.save({
      id: branding.id,
      appName: branding.appName,
      appSubtitle: branding.appSubtitle,
      logo: branding.logo,
    });
  }
}
