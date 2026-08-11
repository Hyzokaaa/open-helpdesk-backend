import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { DepartmentModel } from './department.model';
import { UserModel } from '../../../../user/infrastructure/typeorm/models/user.model';

@Entity('department_members')
@Unique(['departmentId', 'userId'])
export class DepartmentMemberModel {
  @PrimaryColumn()
  id!: string;

  @ManyToOne(() => DepartmentModel, { onDelete: 'CASCADE' })
  department!: DepartmentModel;

  @Column()
  departmentId!: string;

  @ManyToOne(() => UserModel)
  user!: UserModel;

  @Column()
  userId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
