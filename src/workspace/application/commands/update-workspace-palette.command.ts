import { Command } from '../../../shared/domain/command';
import { UpdateWorkspacePalette } from '../../domain/services/workspace-update-palette';

interface Props {
  workspaceId: string;
  palette: string | null;
}

export interface UpdateWorkspacePaletteResponse {
  id: string;
  palette: string | null;
}

export class UpdateWorkspacePaletteCommand implements Command<Props, UpdateWorkspacePaletteResponse> {
  constructor(private readonly updateWorkspacePalette: UpdateWorkspacePalette) {}

  async execute(props: Props): Promise<UpdateWorkspacePaletteResponse> {
    const workspace = await this.updateWorkspacePalette.execute(props);
    return {
      id: workspace.getId(),
      palette: workspace.palette,
    };
  }
}
