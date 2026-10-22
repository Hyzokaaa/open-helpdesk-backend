import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TicketFilterDto, ticketFiltersOf } from '../../../../src/ticket/infrastructure/nest/dto/ticket-filter.dto';
import { inListCondition } from '../../../../src/ticket/infrastructure/typeorm/repositories/in-list-condition';

/** The query string as the controller receives it: transformed, then validated. */
async function parse(query: Record<string, unknown>) {
  const dto = plainToInstance(TicketFilterDto, query);
  const errors = await validate(dto, { whitelist: true });
  return { dto, errors: errors.map((e) => e.property) };
}

describe('Ticket list filters with several values', () => {
  it('reads one status as before, and several comma-separated', async () => {
    expect((await parse({ status: 'open' })).dto.status).toEqual(['open']);
    expect((await parse({ status: 'open,resolved' })).dto.status).toEqual(['open', 'resolved']);
  });

  it('also reads repeated parameters, without blanks or repeats', async () => {
    const { dto, errors } = await parse({ priority: ['high', 'critical,high', ' '] });
    expect(errors).toEqual([]);
    expect(dto.priority).toEqual(['high', 'critical']);
  });

  it('rejects a status or priority that does not exist', async () => {
    expect((await parse({ status: 'open,closed' })).errors).toEqual(['status']);
    expect((await parse({ priority: 'urgent' })).errors).toEqual(['priority']);
  });

  it('reads "none" as the tickets without a department, organization or category', async () => {
    const { dto, errors } = await parse({ departmentId: 'd1,none', organizationId: 'none', categoryId: 'c1' });
    expect(errors).toEqual([]);
    const filters = ticketFiltersOf(dto);
    expect(filters.departmentIds).toEqual(['d1', null]);
    expect(filters.organizationIds).toEqual([null]);
    expect(filters.categoryIds).toEqual(['c1']);
  });

  it('reads "mine" as the departments of the caller, alongside the others', async () => {
    const filters = ticketFiltersOf((await parse({ departmentId: 'mine,d1' })).dto, 'u1');
    expect(filters.departmentIds).toEqual(['d1']);
    expect(filters.departmentsOfUserId).toBe('u1');
    expect(ticketFiltersOf((await parse({ departmentId: 'd1' })).dto, 'u1').departmentsOfUserId).toBeUndefined();
  });

  it('reads reopened=true', async () => {
    expect(ticketFiltersOf((await parse({ reopened: 'true' })).dto).reopened).toBe(true);
    expect((await parse({ reopened: 'yes' })).errors).toEqual(['reopened']);
  });

  it('leaves out a filter that is empty', async () => {
    const filters = ticketFiltersOf((await parse({ status: ',', departmentId: '' })).dto);
    expect(filters.statuses).toBeUndefined();
    expect(filters.departmentIds).toBeUndefined();
  });
});

describe('inListCondition', () => {
  it('matches any of the values', () => {
    expect(inListCondition('ticket.status', ['open', 'pending'], 'statuses'))
      .toEqual({ sql: 'ticket.status IN (:...statuses)', params: { statuses: ['open', 'pending'] } });
  });

  it('matches the rows without a value for null', () => {
    expect(inListCondition('ticket.departmentId', [null], 'd')).toEqual({ sql: 'ticket.departmentId IS NULL', params: {} });
    expect(inListCondition('ticket.departmentId', ['d1', null], 'd'))
      .toEqual({ sql: '(ticket.departmentId IN (:...d) OR ticket.departmentId IS NULL)', params: { d: ['d1'] } });
  });

  it('applies nothing for an empty list', () => {
    expect(inListCondition('ticket.status', [], 's')).toBeNull();
    expect(inListCondition('ticket.status', undefined, 's')).toBeNull();
  });
});
