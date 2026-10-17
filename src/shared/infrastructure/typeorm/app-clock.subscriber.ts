import { Injectable } from '@nestjs/common';
import { DataSource, EntitySubscriberInterface, InsertEvent, UpdateEvent } from 'typeorm';

/**
 * The API server is the one clock for every row it writes. The moments the domain sets
 * (first response, resolution, edits) come from it, so the creation and update times must too:
 * left to the database default they come from another machine's clock, and the time between
 * creating a ticket and answering it can come out negative.
 *
 * A value set on purpose (an import keeping the original dates) is left as it is. SQL written by
 * hand that leaves them out still gets the column default.
 */
@Injectable()
export class AppClockSubscriber implements EntitySubscriberInterface {
  constructor(dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  beforeInsert(event: InsertEvent<Record<string, unknown>>): void {
    const entity = event.entity;
    if (!entity) return;
    const now = new Date();
    for (const column of [event.metadata.createDateColumn, event.metadata.updateDateColumn]) {
      if (column && column.getEntityValue(entity) == null) column.setEntityValue(entity, now);
    }
  }

  beforeUpdate(event: UpdateEvent<Record<string, unknown>>): void {
    const entity = event.entity;
    const column = event.metadata.updateDateColumn;
    if (!entity || !column) return;
    // A save compares against the row as it was loaded: an unchanged updatedAt is not a value set on purpose
    const loaded = event.databaseEntity ? column.getEntityValue(event.databaseEntity) : undefined;
    const current = column.getEntityValue(entity);
    if (current == null || (loaded != null && sameInstant(current, loaded))) column.setEntityValue(entity, new Date());
  }
}

function sameInstant(a: unknown, b: unknown): boolean {
  return a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;
}
