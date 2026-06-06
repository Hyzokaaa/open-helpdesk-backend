import { Command } from '../../../shared/domain/command';
import { SlaPolicy } from '../../domain/entities/workspace';
import { UpdateWorkspaceSlaPolicy } from '../../domain/services/workspace-update-sla-policy';

interface Props {
  workspaceId: string;
  slaPolicy: SlaPolicy | null;
}

export interface UpdateSlaPolicyResponse {
  id: string;
  slaPolicy: SlaPolicy | null;
}

export class UpdateSlaPolicyCommand implements Command<Props, UpdateSlaPolicyResponse> {
  constructor(private readonly updateSlaPolicy: UpdateWorkspaceSlaPolicy) {}

  async execute(props: Props): Promise<UpdateSlaPolicyResponse> {
    const workspace = await this.updateSlaPolicy.execute(props);
    return {
      id: workspace.getId(),
      slaPolicy: workspace.slaPolicy,
    };
  }
}
