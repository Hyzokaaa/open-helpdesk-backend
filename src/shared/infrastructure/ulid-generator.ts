import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import { IdGenerator } from '../domain/id-generator';

@Injectable()
export class UlidGenerator implements IdGenerator {
  create(): string {
    return ulid();
  }
}
