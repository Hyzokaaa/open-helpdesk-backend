import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CORE_NOTICE_KINDS } from '../../../domain/core-notice-kinds';
import { NoticeCatalog } from '../../../domain/notice-catalog';
import { NOTICE_KINDS, NoticeKind } from '../../../domain/notice-kind';

/** The core's kinds of notice and an extension's (NOTICE_KINDS), put together once at start. */
@Injectable()
export class NoticeCatalogProvider implements OnModuleInit {
  private readonly logger = new Logger(NoticeCatalogProvider.name);
  private value = new NoticeCatalog(CORE_NOTICE_KINDS);

  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit(): void {
    let extra: NoticeKind[] = [];
    try {
      extra = this.moduleRef.get<NoticeKind[]>(NOTICE_KINDS, { strict: false });
    } catch {
      // No extension adds kinds: the core ones are all there are
    }
    this.value = new NoticeCatalog([...CORE_NOTICE_KINDS, ...extra]);
    this.logger.log(`Notice kinds: ${this.value.all().map((k) => k.key).join(', ')}`);
  }

  get catalog(): NoticeCatalog {
    return this.value;
  }
}
