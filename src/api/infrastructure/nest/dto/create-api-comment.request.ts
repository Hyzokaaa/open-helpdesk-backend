import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateApiCommentRequest {
  @ApiProperty({
    description: 'Comment body. HTML is accepted and sanitized on the server.',
    example: '<p>We have reset your password, please try again.</p>',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
