import { Logger } from '@nestjs/common';
import { Command } from '../../../shared/domain/command';
import { ParseInboundEmail } from '../../domain/services/parse-inbound-email';
import { RouteInboundEmail, RouteInboundEmailResult } from '../../domain/services/route-inbound-email';
import { MtaHookPayload } from '../../infrastructure/nest/dto/mta-hook-payload.dto';

interface Props {
  payload: MtaHookPayload;
}

export class ProcessInboundEmailCommand implements Command<Props, RouteInboundEmailResult> {
  private readonly logger = new Logger(ProcessInboundEmailCommand.name);

  constructor(
    private readonly parser: ParseInboundEmail,
    private readonly router: RouteInboundEmail,
  ) {}

  async execute(props: Props): Promise<RouteInboundEmailResult> {
    const parsed = await this.parser.execute(props.payload);
    this.logger.log(`Inbound email from ${parsed.fromAddress} to ${parsed.toAddresses.join(', ')} — subject: ${parsed.subject}`);
    const result = await this.router.execute(parsed);
    this.logger.log(`Inbound email routed: ${result.action}${result.ticketId ? ` (ticket: ${result.ticketId})` : ''}${result.reason ? ` (reason: ${result.reason})` : ''}`);
    return result;
  }
}
