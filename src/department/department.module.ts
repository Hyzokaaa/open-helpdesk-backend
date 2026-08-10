import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { UserModule } from '../user/user.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { DepartmentModel } from './infrastructure/typeorm/models/department.model';
import { DepartmentMemberModel } from './infrastructure/typeorm/models/department-member.model';
import { TypeOrmDepartmentRepository } from './infrastructure/typeorm/repositories/typeorm-department.repository';
import { TypeOrmDepartmentMemberRepository } from './infrastructure/typeorm/repositories/typeorm-department-member.repository';
import { DepartmentController } from './infrastructure/nest/controllers/department.controller';

@Module({
  imports: [
    SharedModule,
    WorkspaceModule,
    UserModule,
    AuditLogModule,
    TypeOrmModule.forFeature([DepartmentModel, DepartmentMemberModel]),
  ],
  controllers: [DepartmentController],
  providers: [TypeOrmDepartmentRepository, TypeOrmDepartmentMemberRepository],
  exports: [TypeOrmDepartmentRepository, TypeOrmDepartmentMemberRepository],
})
export class DepartmentModule {}
