interface AssignedData {
  ticketName: string;
  ticketUrl: string;
  assigneeName: string;
  workspaceName: string;
}

interface UnassignedData {
  ticketName: string;
  ticketUrl: string;
  workspaceName: string;
}

export class TicketAssignedTemplate {
  assignedSubject(data: AssignedData): string {
    return `[${data.workspaceName}] Ticket assigned to you: ${data.ticketName}`;
  }

  assignedHtml(data: AssignedData): string {
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
      <h2 style="color: #1f2937; margin-top: 0;">Ticket Assigned to You</h2>
      <p style="color: #4b5563;">Hi <strong>${data.assigneeName}</strong>, a ticket has been assigned to you in <strong>${data.workspaceName}</strong>.</p>
      <p style="color: #1f2937; font-weight: bold; font-size: 16px; margin: 20px 0;">${data.ticketName}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.ticketUrl}" style="background-color: #6330f7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Ticket</a>
      </div>
    </div>
  </div>
</body>
</html>`.trim();
  }

  unassignedSubject(data: UnassignedData): string {
    return `[${data.workspaceName}] You have been unassigned from: ${data.ticketName}`;
  }

  unassignedHtml(data: UnassignedData): string {
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
      <h2 style="color: #1f2937; margin-top: 0;">Ticket Unassigned</h2>
      <p style="color: #4b5563;">You have been unassigned from the following ticket in <strong>${data.workspaceName}</strong>.</p>
      <p style="color: #1f2937; font-weight: bold; font-size: 16px; margin: 20px 0;">${data.ticketName}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.ticketUrl}" style="background-color: #6330f7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Ticket</a>
      </div>
    </div>
  </div>
</body>
</html>`.trim();
  }
}
