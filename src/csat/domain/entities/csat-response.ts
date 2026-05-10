import { Id } from '../../../shared/domain/id';
import { CsatRating } from '../enums/csat-rating.enum';

interface Props {
  id: string;
  ticketId: string;
  workspaceId: string;
  token: string;
  rating: CsatRating | null;
  respondedAt: Date | null;
}

export class CsatResponse {
  readonly id: Id;
  ticketId: string;
  workspaceId: string;
  token: string;
  rating: CsatRating | null;
  respondedAt: Date | null;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.ticketId = props.ticketId;
    this.workspaceId = props.workspaceId;
    this.token = props.token;
    this.rating = props.rating;
    this.respondedAt = props.respondedAt;
  }

  getId(): string {
    return this.id.get();
  }
}
