import { Id } from '../../../shared/domain/id';
import { CustomFieldType } from '../enums/custom-field-type.enum';

interface Props {
  id: string;
  workspaceId: string;
  name: string;
  type: CustomFieldType;
  options: string[] | null;
  position: number;
  required: boolean;
}

export class CustomFieldDefinition {
  readonly id: Id;
  workspaceId: string;
  name: string;
  type: CustomFieldType;
  options: string[] | null;
  position: number;
  required: boolean;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.workspaceId = props.workspaceId;
    this.name = props.name;
    this.type = props.type;
    this.options = props.options;
    this.position = props.position;
    this.required = props.required;
  }

  getId(): string {
    return this.id.get();
  }
}
