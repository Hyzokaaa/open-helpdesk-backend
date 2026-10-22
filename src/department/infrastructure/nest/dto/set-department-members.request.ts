import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class SetDepartmentMembersRequest {
  /** The whole list of agents the department ends up with; an empty list takes everyone out. */
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  userIds!: string[];
}
