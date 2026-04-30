import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Workspace } from '../entities/workspace';
import { WorkspaceRepository } from '../repositories/workspace.repository';

export const ALLOWED_PALETTES = [
  'green',
  'blue',
  'purple',
  'orange',
  'rose',
  'teal',
  'indigo',
] as const;

interface UpdateWorkspacePaletteProps {
  workspaceId: string;
  palette: string | null;
}

const CUSTOM_PALETTE_REGEX = /^custom:#[0-9a-fA-F]{6}$/;

function isValidPalette(palette: string): boolean {
  return ALLOWED_PALETTES.includes(palette as any) || CUSTOM_PALETTE_REGEX.test(palette);
}

export class UpdateWorkspacePalette {
  constructor(private readonly repository: WorkspaceRepository) {}

  async execute(props: UpdateWorkspacePaletteProps): Promise<Workspace> {
    if (props.palette !== null && !isValidPalette(props.palette)) {
      throw new Error(`Invalid palette: ${props.palette}`);
    }

    const workspace = await this.repository.findById(props.workspaceId);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    workspace.palette = props.palette;
    await this.repository.update(workspace);
    return workspace;
  }
}
