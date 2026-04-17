interface Data {
  ticketName: string;
  ticketUrl: string;
  creatorName: string;
  priority: string;
  category: string;
  workspaceName: string;
}

export class TicketCreatedTemplate {
  subject(data: Data): string {
    return `[${data.workspaceName}] New ticket: ${data.ticketName}`;
  }

  html(data: Data): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #6330f7; margin: 0;">DealerNode Helpdesk</h1>
    </div>
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
      <h2 style="color: #1f2937; margin-top: 0;">New Ticket Created</h2>
      <p style="color: #4b5563;"><strong>${data.creatorName}</strong> created a new ticket in <strong>${data.workspaceName}</strong>.</p>
      <table style="width: 100%; margin: 20px 0;">
        <tr><td style="color: #6b7280; padding: 4px 0;">Title</td><td style="color: #1f2937; font-weight: bold;">${data.ticketName}</td></tr>
        <tr><td style="color: #6b7280; padding: 4px 0;">Priority</td><td style="color: #1f2937;">${data.priority}</td></tr>
        <tr><td style="color: #6b7280; padding: 4px 0;">Category</td><td style="color: #1f2937;">${data.category}</td></tr>
      </table>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.ticketUrl}" style="background-color: #6330f7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Ticket</a>
      </div>
    </div>
  </div>
</body>
</html>`.trim();
  }
}
