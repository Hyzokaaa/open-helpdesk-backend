import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../shared/shared.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { TicketModule } from '../ticket/ticket.module';
import { UserModule } from '../user/user.module';
import { DepartmentModule } from '../department/department.module';
import { ProjectModule } from '../project/project.module';
import { OrganizationModule } from '../organization/organization.module';
import { AttachmentModule } from '../attachment/attachment.module';
import { MatrixBotModel } from './infrastructure/typeorm/models/matrix-bot.model';
import { MatrixRoomModel } from './infrastructure/typeorm/models/matrix-room.model';
import { MatrixTicketThreadModel } from './infrastructure/typeorm/models/matrix-ticket-thread.model';
import { MatrixIdentityModel } from './infrastructure/typeorm/models/matrix-identity.model';
import { MatrixDirectRoomModel } from './infrastructure/typeorm/models/matrix-direct-room.model';
import { MatrixRoomCreationModel } from './infrastructure/typeorm/models/matrix-room-creation.model';
import { TypeOrmMatrixBotRepository } from './infrastructure/typeorm/repositories/typeorm-matrix-bot.repository';
import { TypeOrmMatrixRoomRepository } from './infrastructure/typeorm/repositories/typeorm-matrix-room.repository';
import { TypeOrmMatrixTicketThreadRepository } from './infrastructure/typeorm/repositories/typeorm-matrix-ticket-thread.repository';
import { TypeOrmMatrixIdentityRepository } from './infrastructure/typeorm/repositories/typeorm-matrix-identity.repository';
import { TypeOrmMatrixDirectRoomRepository } from './infrastructure/typeorm/repositories/typeorm-matrix-direct-room.repository';
import { TypeOrmMatrixRoomCreationRepository } from './infrastructure/typeorm/repositories/typeorm-matrix-room-creation.repository';
import { HttpMatrixClient } from './infrastructure/http/http-matrix-client';
import { MatrixNoticeService } from './infrastructure/nest/services/matrix-notice.service';
import { MatrixDirectNoticeService } from './infrastructure/nest/services/matrix-direct-notice.service';
import { SystemMatrixController } from './infrastructure/nest/controllers/system-matrix.controller';
import { WorkspaceMatrixController } from './infrastructure/nest/controllers/workspace-matrix.controller';
import { UserMatrixController } from './infrastructure/nest/controllers/user-matrix.controller';

@Module({
  imports: [
    SharedModule,
    AuditLogModule,
    WorkspaceModule,
    TicketModule,
    UserModule,
    DepartmentModule,
    ProjectModule,
    OrganizationModule,
    AttachmentModule,
    TypeOrmModule.forFeature([MatrixBotModel, MatrixRoomModel, MatrixTicketThreadModel, MatrixIdentityModel, MatrixDirectRoomModel, MatrixRoomCreationModel]),
  ],
  controllers: [SystemMatrixController, WorkspaceMatrixController, UserMatrixController],
  providers: [
    TypeOrmMatrixBotRepository,
    TypeOrmMatrixRoomRepository,
    TypeOrmMatrixTicketThreadRepository,
    TypeOrmMatrixIdentityRepository,
    TypeOrmMatrixDirectRoomRepository,
    TypeOrmMatrixRoomCreationRepository,
    HttpMatrixClient,
    MatrixNoticeService,
    MatrixDirectNoticeService,
  ],
  exports: [TypeOrmMatrixBotRepository, TypeOrmMatrixRoomRepository],
})
export class MatrixModule {}
