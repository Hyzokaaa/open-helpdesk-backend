import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { UserModule } from '../user/user.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { OrganizationModel } from './infrastructure/typeorm/models/organization.model';
import { TypeOrmOrganizationRepository } from './infrastructure/typeorm/repositories/typeorm-organization.repository';
import { OrganizationController } from './infrastructure/nest/controllers/organization.controller';

@Module({
  imports: [
    SharedModule,
    WorkspaceModule,
    UserModule,
    AuditLogModule,
    TypeOrmModule.forFeature([OrganizationModel]),
  ],
  controllers: [OrganizationController],
  providers: [TypeOrmOrganizationRepository],
  exports: [TypeOrmOrganizationRepository],
})
export class OrganizationModule {}
