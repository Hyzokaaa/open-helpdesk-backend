import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ProjectModel } from './infrastructure/typeorm/models/project.model';
import { TicketCategoryModel } from './infrastructure/typeorm/models/ticket-category.model';
import { ProjectCategoryModel } from './infrastructure/typeorm/models/project-category.model';
import { TypeOrmProjectRepository } from './infrastructure/typeorm/repositories/typeorm-project.repository';
import { TypeOrmTicketCategoryRepository } from './infrastructure/typeorm/repositories/typeorm-ticket-category.repository';
import { ProjectController } from './infrastructure/nest/controllers/project.controller';
import { TicketCategoryController } from './infrastructure/nest/controllers/ticket-category.controller';

@Module({
  imports: [
    SharedModule,
    forwardRef(() => WorkspaceModule),
    AuditLogModule,
    TypeOrmModule.forFeature([ProjectModel, TicketCategoryModel, ProjectCategoryModel]),
  ],
  controllers: [ProjectController, TicketCategoryController],
  providers: [TypeOrmProjectRepository, TypeOrmTicketCategoryRepository],
  exports: [TypeOrmProjectRepository, TypeOrmTicketCategoryRepository],
})
export class ProjectModule {}
