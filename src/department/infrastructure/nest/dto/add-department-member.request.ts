import { IsNotEmpty, IsString } from 'class-validator';

export class AddDepartmentMemberRequest {
  @IsString()
  @IsNotEmpty()
  userId!: string;
}
