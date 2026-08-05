import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SortOptions } from '../../../../shared/domain/sort-options';
import { User } from '../../../domain/entities/user';
import { UserRepository } from '../../../domain/repositories/user.repository';
import { UserModel } from '../models/user.model';

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserModel)
    private readonly repository: Repository<UserModel>,
  ) {}

  async create(user: User): Promise<void> {
    const model = this.toModel(user);
    await this.repository.save(model);
  }

  async findById(id: string): Promise<User | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const model = await this.repository.findOneBy({ email });
    return model ? this.toDomain(model) : null;
  }

  private static readonly VALID_SORT_FIELDS: Record<string, { col: string; lower: boolean }> = {
    firstName: { col: 'user.firstName', lower: true },
    lastName: { col: 'user.lastName', lower: true },
    email: { col: 'user.email', lower: true },
    isSystemAdmin: { col: 'user.isSystemAdmin', lower: false },
    isActive: { col: 'user.isActive', lower: false },
    createdAt: { col: 'user.createdAt', lower: false },
  };

  async findAll(sort?: SortOptions): Promise<User[]> {
    const qb = this.repository.createQueryBuilder('user');
    const field = TypeOrmUserRepository.VALID_SORT_FIELDS[sort?.sortBy ?? '']
      ?? { col: 'user.createdAt', lower: false };
    const sortOrder = sort?.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const expr = field.lower ? `LOWER(${field.col})` : field.col;
    qb.orderBy(expr, sortOrder);
    const models = await qb.getMany();
    return models.map((m) => this.toDomain(m));
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    const models = await this.repository.findBy({ id: In(ids) });
    return models.map((m) => this.toDomain(m));
  }

  async update(user: User): Promise<void> {
    const model = this.toModel(user);
    await this.repository.save(model);
  }

  private toDomain(model: UserModel): User {
    return new User({
      id: model.id,
      email: model.email,
      password: model.password,
      firstName: model.firstName,
      lastName: model.lastName,
      isActive: model.isActive,
      isSystemAdmin: model.isSystemAdmin,
      isEmailVerified: model.isEmailVerified,
      language: model.language,
      theme: model.theme,
      dateFormat: model.dateFormat,
      timezone: model.timezone,
      autoCreated: model.autoCreated,
    });
  }

  private toModel(user: User): UserModel {
    const model = new UserModel();
    model.id = user.getId();
    model.email = user.email;
    model.password = user.password;
    model.firstName = user.firstName;
    model.lastName = user.lastName;
    model.isActive = user.isActive;
    model.isSystemAdmin = user.isSystemAdmin;
    model.isEmailVerified = user.isEmailVerified;
    model.language = user.language;
    model.theme = user.theme;
    model.dateFormat = user.dateFormat;
    model.timezone = user.timezone;
    model.autoCreated = user.autoCreated;
    return model;
  }
}
