import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { KbCategoryModel } from './infrastructure/typeorm/models/kb-category.model';
import { KbArticleModel } from './infrastructure/typeorm/models/kb-article.model';
import { TypeOrmKbCategoryRepository } from './infrastructure/typeorm/repositories/typeorm-kb-category.repository';
import { TypeOrmKbArticleRepository } from './infrastructure/typeorm/repositories/typeorm-kb-article.repository';
import { KbController } from './infrastructure/nest/controllers/kb.controller';
import { KbPortalController } from './infrastructure/nest/controllers/kb-portal.controller';

@Module({
  imports: [SharedModule, WorkspaceModule, AuditLogModule, TypeOrmModule.forFeature([KbCategoryModel, KbArticleModel])],
  controllers: [KbController, KbPortalController],
  providers: [TypeOrmKbCategoryRepository, TypeOrmKbArticleRepository],
  exports: [TypeOrmKbCategoryRepository, TypeOrmKbArticleRepository],
})
export class KnowledgeBaseModule {}
