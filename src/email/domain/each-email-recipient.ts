/**
 * Notification emails go out one per recipient, never with everyone in "To": nobody sees
 * the other recipients' addresses, and "reply all" cannot bypass the helpdesk.
 *
 * Takes the recipients grouped by language, as DispatchNotifications returns them, and yields
 * each one with its language, as the single-address list the senders expect.
 */
export function eachEmailRecipient(byLanguage: Map<string, string[]>): Array<[lang: string, to: string[]]> {
  const recipients: Array<[string, string[]]> = [];
  for (const [lang, emails] of byLanguage) {
    for (const email of new Set(emails)) recipients.push([lang, [email]]);
  }
  return recipients;
}
