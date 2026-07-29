import { Id } from '../../../shared/domain/id';
import { KbArticleStatus } from '../enums/kb-article-status.enum';

interface Props {
  id: string;
  title: string;
  slug: string;
  content: string;
  status: KbArticleStatus;
  position: number;
  categoryId: string;
  workspaceId: string;
  createdById: string;
}

export class KbArticle {
  readonly id: Id;
  title: string;
  slug: string;
  content: string;
  status: KbArticleStatus;
  position: number;
  categoryId: string;
  workspaceId: string;
  createdById: string;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.title = props.title;
    this.slug = props.slug;
    this.content = props.content;
    this.status = props.status;
    this.position = props.position;
    this.categoryId = props.categoryId;
    this.workspaceId = props.workspaceId;
    this.createdById = props.createdById;
  }

  getId(): string {
    return this.id.get();
  }
}
