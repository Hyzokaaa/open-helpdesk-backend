import { IsBoolean, IsIn, IsString, MaxLength } from 'class-validator';
import { NOTICE_CHANNELS, NoticeChannel } from '../../../domain/notice-kind';

/** Always the authenticated user's own: there is no `userId` on purpose. */
export class UpdateNoticePreferenceRequest {
  @IsString() @MaxLength(100) kind!: string;
  @IsIn(NOTICE_CHANNELS) channel!: NoticeChannel;
  @IsBoolean() enabled!: boolean;
}
