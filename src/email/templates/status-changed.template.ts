interface Data {
  ticketName: string;
  ticketUrl: string;
  oldStatus: string;
  newStatus: string;
  workspaceName: string;
}

export class StatusChangedTemplate {
  subject(data: Data): string {
    return `[${data.workspaceName}] Ticket status changed: ${data.ticketName}`;
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
      <h2 style="color: #1f2937; margin-top: 0;">Status Changed</h2>
      <p style="color: #4b5563;">The status of <strong>${data.ticketName}</strong> has been updated.</p>
      <div style="margin: 20px 0; text-align: center;">
        <span style="background-color: #e5e7eb; padding: 6px 12px; border-radius: 4px; color: #6b7280;">${data.oldStatus}</span>
        <span style="color: #6b7280; margin: 0 8px;">→</span>
        <span style="background-color: #e9e8ff; padding: 6px 12px; border-radius: 4px; color: #6330f7; font-weight: bold;">${data.newStatus}</span>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.ticketUrl}" style="background-color: #6330f7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Ticket</a>
      </div>
    </div>
  </div>
</body>
</html>`.trim();
  }
}
