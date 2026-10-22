import { TicketStatus } from '../../../../src/ticket/domain/enums/ticket-status.enum';
import { NEEDS_ASSIGNEE_MESSAGE, assigneeForStatus, ensureAssignmentFits, settleAssignment, statusForAssignee } from '../../../../src/ticket/domain/ticket-assignment-rule';
import { DomainValidationError } from '../../../../src/shared/domain/errors';

describe('How status and assignee fit together', () => {
  it('keeps work with somebody to do it', () => {
    expect(settleAssignment(TicketStatus.PENDING, 'carlos')).toBe(TicketStatus.PENDING);
    expect(settleAssignment(TicketStatus.IN_PROGRESS, 'carlos')).toBe(TicketStatus.IN_PROGRESS);
  });

  it('sends work with nobody to do it to the queue', () => {
    expect(settleAssignment(TicketStatus.PENDING, null)).toBe(TicketStatus.OPEN);
    expect(settleAssignment(TicketStatus.IN_PROGRESS, null)).toBe(TicketStatus.OPEN);
  });

  it('refuses the queue with somebody assigned', () => {
    expect(settleAssignment(TicketStatus.OPEN, null)).toBe(TicketStatus.OPEN);
    expect(() => settleAssignment(TicketStatus.OPEN, 'carlos')).toThrow(DomainValidationError);
  });

  it('leaves closed tickets alone, with or without an assignee', () => {
    expect(settleAssignment(TicketStatus.RESOLVED, null)).toBe(TicketStatus.RESOLVED);
    expect(settleAssignment(TicketStatus.DISCARDED, 'carlos')).toBe(TicketStatus.DISCARDED);
  });
});

describe('When only one of the two changes, the other follows', () => {
  it('only the assignee: somebody takes a queued ticket to Pending, nobody sends work to the queue', () => {
    expect(statusForAssignee(TicketStatus.OPEN, 'carlos')).toBe(TicketStatus.PENDING);
    expect(statusForAssignee(TicketStatus.IN_PROGRESS, null)).toBe(TicketStatus.OPEN);
    expect(statusForAssignee(TicketStatus.IN_PROGRESS, 'carlos')).toBe(TicketStatus.IN_PROGRESS);
    expect(statusForAssignee(TicketStatus.RESOLVED, null)).toBe(TicketStatus.RESOLVED);
  });

  it('only the status: the queue lets go, work with nobody takes whoever moved it, or is refused', () => {
    expect(assigneeForStatus(TicketStatus.OPEN, 'carlos', 'stephen')).toBeNull();
    expect(assigneeForStatus(TicketStatus.PENDING, null, 'stephen')).toBe('stephen');
    expect(assigneeForStatus(TicketStatus.IN_PROGRESS, 'carlos', 'stephen')).toBe('carlos');
    expect(assigneeForStatus(TicketStatus.RESOLVED, null, null)).toBeNull();
    expect(() => assigneeForStatus(TicketStatus.IN_PROGRESS, null, null)).toThrow(NEEDS_ASSIGNEE_MESSAGE);
  });

  it('both asked for at once must fit', () => {
    expect(() => ensureAssignmentFits(TicketStatus.OPEN, 'carlos')).toThrow(DomainValidationError);
    expect(() => ensureAssignmentFits(TicketStatus.PENDING, null)).toThrow(NEEDS_ASSIGNEE_MESSAGE);
    expect(() => ensureAssignmentFits(TicketStatus.IN_PROGRESS, 'carlos')).not.toThrow();
    expect(() => ensureAssignmentFits(TicketStatus.OPEN, null)).not.toThrow();
    expect(() => ensureAssignmentFits(TicketStatus.RESOLVED, null)).not.toThrow();
  });
});
