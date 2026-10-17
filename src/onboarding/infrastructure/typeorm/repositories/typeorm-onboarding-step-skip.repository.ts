import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnboardingStepSkip } from '../../../domain/entities/onboarding-step-skip';
import { OnboardingStepSkipRepository } from '../../../domain/repositories/onboarding-step-skip.repository';
import { OnboardingStepSkipModel } from '../models/onboarding-step-skip.model';

@Injectable()
export class TypeOrmOnboardingStepSkipRepository implements OnboardingStepSkipRepository {
  constructor(
    @InjectRepository(OnboardingStepSkipModel)
    private readonly repository: Repository<OnboardingStepSkipModel>,
  ) {}

  async create(skip: OnboardingStepSkip): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .insert()
      .values({ id: skip.getId(), userId: skip.userId, step: skip.step })
      .orIgnore()
      .execute();
  }

  async findStepsByUserId(userId: string): Promise<string[]> {
    const rows = await this.repository.find({ where: { userId }, select: ['step'] });
    return rows.map((r) => r.step);
  }
}
