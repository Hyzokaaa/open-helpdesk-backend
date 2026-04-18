import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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

  async findAll(): Promise<User[]> {
    const models = await this.repository.find();
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
    return model;
  }
}
