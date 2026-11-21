import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { MatrixBot } from '../../../domain/entities/matrix-bot';
import { MatrixBotRepository } from '../../../domain/repositories/matrix-bot.repository';
import { MatrixBotModel } from '../models/matrix-bot.model';

@Injectable()
export class TypeOrmMatrixBotRepository implements MatrixBotRepository {
  constructor(
    @InjectRepository(MatrixBotModel)
    private readonly repository: Repository<MatrixBotModel>,
  ) {}

  async findInstallation(): Promise<MatrixBot | null> {
    const model = await this.repository.findOneBy({ workspaceId: IsNull() });
    return model ? this.toDomain(model) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<MatrixBot | null> {
    const model = await this.repository.findOneBy({ workspaceId });
    return model ? this.toDomain(model) : null;
  }

  async findById(id: string): Promise<MatrixBot | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findAll(): Promise<MatrixBot[]> {
    return (await this.repository.find()).map((model) => this.toDomain(model));
  }

  async save(bot: MatrixBot): Promise<void> {
    await this.repository.save({
      id: bot.getId(),
      workspaceId: bot.workspaceId,
      homeserverUrl: bot.homeserverUrl,
      userId: bot.userId,
      deviceId: bot.deviceId,
      encryptedAccessToken: bot.encryptedAccessToken,
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  private toDomain(model: MatrixBotModel): MatrixBot {
    return new MatrixBot({
      id: model.id,
      workspaceId: model.workspaceId,
      homeserverUrl: model.homeserverUrl,
      userId: model.userId,
      deviceId: model.deviceId,
      encryptedAccessToken: model.encryptedAccessToken,
    });
  }
}
