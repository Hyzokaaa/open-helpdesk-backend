import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../../domain/entities/account';
import { AccountRepository } from '../../../domain/repositories/account.repository';
import { AccountModel } from '../models/account.model';

@Injectable()
export class TypeOrmAccountRepository implements AccountRepository {
  constructor(
    @InjectRepository(AccountModel)
    private readonly repository: Repository<AccountModel>,
  ) {}

  async create(account: Account): Promise<void> {
    await this.repository.save(this.toModel(account));
  }

  async findById(id: string): Promise<Account | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findByOwnerId(ownerId: string): Promise<Account | null> {
    const model = await this.repository.findOneBy({ ownerId });
    return model ? this.toDomain(model) : null;
  }

  private toDomain(model: AccountModel): Account {
    return new Account({
      id: model.id,
      ownerId: model.ownerId,
      name: model.name,
    });
  }

  private toModel(account: Account): AccountModel {
    const model = new AccountModel();
    model.id = account.getId();
    model.ownerId = account.ownerId;
    model.name = account.name;
    return model;
  }
}
