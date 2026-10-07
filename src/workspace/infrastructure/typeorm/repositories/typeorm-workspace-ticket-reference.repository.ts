import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceTicketReference } from '../../../domain/entities/workspace-ticket-reference';
import { WorkspaceTicketReferenceRepository } from '../../../domain/repositories/workspace-ticket-reference.repository';
import { WorkspaceTicketReferenceModel } from '../models/workspace-ticket-reference.model';

@Injectable()
export class TypeOrmWorkspaceTicketReferenceRepository implements WorkspaceTicketReferenceRepository {
  constructor(
    @InjectRepository(WorkspaceTicketReferenceModel)
    private readonly repository: Repository<WorkspaceTicketReferenceModel>,
  ) {}

  async findByWorkspaceId(workspaceId: string): Promise<WorkspaceTicketReference | null> {
    const model = await this.repository.findOneBy({ workspaceId });
    return model ? new WorkspaceTicketReference({ workspaceId: model.workspaceId, style: model.style, prefix: model.prefix, secret: model.secret }) : null;
  }

  async save(reference: WorkspaceTicketReference): Promise<void> {
    await this.repository.save({ workspaceId: reference.workspaceId, style: reference.style, prefix: reference.prefix, secret: reference.secret });
  }
}
