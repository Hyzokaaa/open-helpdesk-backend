import { matrixNoticeContent } from '../../../src/matrix/domain/matrix-notice-content';
import { matrixText } from '../../../src/matrix/domain/matrix-notice-texts';
import { MatrixNoticeThrottle } from '../../../src/matrix/domain/matrix-notice-throttle';

describe('Matrix notice content', () => {
  const notice = {
    icon: '🎫',
    headline: 'New ticket TK-7',
    subject: 'Printer <b>on fire</b> & smoking',
    details: ['Priority: high', '', 'Customer: Bob'],
    link: { url: 'https://help.example.org/dashboard/workspaces/acme/tickets/01J?x="1"', label: 'Open ticket' },
  };

  it('is an m.notice with a plain body and escaped HTML', () => {
    const content = matrixNoticeContent(notice, null);
    expect(content.msgtype).toBe('m.notice');
    expect(content.body).toBe('🎫 New ticket TK-7 · Printer <b>on fire</b> & smoking\nPriority: high · Customer: Bob\nhttps://help.example.org/dashboard/workspaces/acme/tickets/01J?x="1"');
    expect(content.formatted_body).toContain('Printer &lt;b&gt;on fire&lt;/b&gt; &amp; smoking');
    expect(content.formatted_body).toContain('href="https://help.example.org/dashboard/workspaces/acme/tickets/01J?x=&quot;1&quot;"');
    expect(content.formatted_body).not.toContain('<b>on fire</b>');
  });

  it('asks clients not to preview the link', () => {
    expect(matrixNoticeContent(notice, null)['com.beeper.linkpreviews']).toEqual([]);
  });

  it('answers in the ticket\'s thread when it has one, and opens none otherwise', () => {
    expect(matrixNoticeContent(notice, null)['m.relates_to']).toBeUndefined();
    expect(matrixNoticeContent(notice, '$root')['m.relates_to']).toEqual({
      rel_type: 'm.thread', event_id: '$root', is_falling_back: true, 'm.in_reply_to': { event_id: '$root' },
    });
  });

  it('quotes the excerpt, escaped, only when there is one', () => {
    const content = matrixNoticeContent({ ...notice, excerpt: 'It <script>burns</script>\nsince Monday' }, null);
    expect(content.body).toContain('> It <script>burns</script>\n> since Monday');
    expect(content.formatted_body).toContain('<blockquote>It &lt;script&gt;burns&lt;/script&gt;<br>since Monday</blockquote>');
    expect(matrixNoticeContent(notice, null).formatted_body).not.toContain('blockquote');
  });
});

describe('Matrix notice texts', () => {
  it('speaks the workspace\'s language, English otherwise', () => {
    expect(matrixText('es', 'created', { ref: 'TK-1' })).toBe('Ticket nuevo TK-1');
    expect(matrixText('fr', 'created', { ref: 'TK-1' })).toBe('New ticket TK-1');
    expect(matrixText(null, 'priority', { value: 'high' })).toBe('Priority: high');
  });
});

describe('MatrixNoticeThrottle', () => {
  it('lets a room have its limit per minute and counts the rest for one summary', () => {
    let now = 0;
    const throttle = new MatrixNoticeThrottle(3, () => now);
    const taken = Array.from({ length: 5 }, () => throttle.take('room-1'));
    expect(taken).toEqual([true, true, true, false, false]);
    expect(throttle.take('room-2')).toBe(true);

    expect(throttle.drain()).toEqual([]);
    now = 60_000;
    expect(throttle.drain()).toEqual([{ roomKey: 'room-1', skipped: 2 }]);
    expect(throttle.drain()).toEqual([]);
    expect(throttle.take('room-1')).toBe(true);
  });

  it('keeps the count of a window that a new notice replaced before the summary went out', () => {
    let now = 0;
    const throttle = new MatrixNoticeThrottle(1, () => now);
    throttle.take('room-1');
    throttle.take('room-1');
    now = 61_000;
    expect(throttle.take('room-1')).toBe(true);
    expect(throttle.drain()).toEqual([{ roomKey: 'room-1', skipped: 1 }]);
  });
});
