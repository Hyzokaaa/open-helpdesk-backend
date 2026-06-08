import { WorkspaceRole } from '../enums/workspace-role.enum';

export interface CsvRow {
  email: string;
  firstName: string;
  lastName: string;
  role: WorkspaceRole;
}

export interface ParsedRow {
  email: string;
  firstName: string;
  lastName: string;
  role: WorkspaceRole;
  status: 'new_user' | 'existing_user';
}

export interface CsvError {
  row: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  error: string;
}

export interface ImportPreview {
  valid: ParsedRow[];
  errors: CsvError[];
  summary: { toCreate: number; errors: number; alreadyMembers: number };
}

interface UserLookup {
  findByEmail(email: string): Promise<{ getId(): string } | null>;
}

interface MemberLookup {
  findByWorkspaceAndUser(workspaceId: string, userId: string): Promise<unknown | null>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = new Set(Object.values(WorkspaceRole));

export class ParseImportCsv {
  constructor(
    private readonly userRepository: UserLookup,
    private readonly memberRepository: MemberLookup,
  ) {}

  async execute(props: { csv: string; workspaceId: string }): Promise<ImportPreview> {
    const lines = this.parseLines(props.csv);

    if (lines.length === 0) {
      return { valid: [], errors: [{ row: 1, email: '', firstName: '', lastName: '', role: '', error: 'Empty CSV file' }], summary: { toCreate: 0, errors: 1, alreadyMembers: 0 } };
    }

    const header = lines[0].map((h) => h.trim().toLowerCase());
    const expectedHeaders = ['email', 'firstname', 'lastname', 'role'];
    const isHeaderRow = expectedHeaders.every((h) => header.includes(h));

    if (!isHeaderRow) {
      return { valid: [], errors: [{ row: 1, email: '', firstName: '', lastName: '', role: '', error: 'Invalid headers. Expected: email,firstName,lastName,role' }], summary: { toCreate: 0, errors: 1, alreadyMembers: 0 } };
    }

    const emailIdx = header.indexOf('email');
    const firstNameIdx = header.indexOf('firstname');
    const lastNameIdx = header.indexOf('lastname');
    const roleIdx = header.indexOf('role');

    const valid: ParsedRow[] = [];
    const errors: CsvError[] = [];
    const seenEmails = new Set<string>();
    let alreadyMembers = 0;

    for (let i = 1; i < lines.length; i++) {
      const fields = lines[i];
      const rowNum = i + 1;

      const email = (fields[emailIdx] ?? '').trim().toLowerCase();
      const firstName = (fields[firstNameIdx] ?? '').trim();
      const lastName = (fields[lastNameIdx] ?? '').trim();
      const roleRaw = (fields[roleIdx] ?? '').trim().toLowerCase();

      if (!email && !firstName && !lastName && !roleRaw) {
        continue;
      }

      if (!email) {
        errors.push({ row: rowNum, email: '', firstName, lastName, role: roleRaw, error: 'Email is required' });
        continue;
      }

      if (!EMAIL_REGEX.test(email)) {
        errors.push({ row: rowNum, email, firstName, lastName, role: roleRaw, error: 'Invalid email format' });
        continue;
      }

      if (!firstName) {
        errors.push({ row: rowNum, email, firstName, lastName, role: roleRaw, error: 'First name is required' });
        continue;
      }

      if (!VALID_ROLES.has(roleRaw as WorkspaceRole)) {
        errors.push({ row: rowNum, email, firstName, lastName, role: roleRaw, error: `Invalid role. Must be one of: ${Object.values(WorkspaceRole).join(', ')}` });
        continue;
      }

      if (seenEmails.has(email)) {
        errors.push({ row: rowNum, email, firstName, lastName, role: roleRaw, error: 'Duplicate email in CSV' });
        continue;
      }

      seenEmails.add(email);

      const existingUser = await this.userRepository.findByEmail(email);
      if (existingUser) {
        const isMember = await this.memberRepository.findByWorkspaceAndUser(
          props.workspaceId,
          existingUser.getId(),
        );
        if (isMember) {
          alreadyMembers++;
          errors.push({ row: rowNum, email, firstName, lastName, role: roleRaw, error: 'Already a member of this workspace' });
          continue;
        }
        valid.push({ email, firstName, lastName, role: roleRaw as WorkspaceRole, status: 'existing_user' });
      } else {
        valid.push({ email, firstName, lastName, role: roleRaw as WorkspaceRole, status: 'new_user' });
      }
    }

    return {
      valid,
      errors,
      summary: {
        toCreate: valid.length,
        errors: errors.length,
        alreadyMembers,
      },
    };
  }

  private parseLines(csv: string): string[][] {
    // Strip BOM
    let content = csv;
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    // Normalize line endings
    content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const lines: string[][] = [];
    let current = '';
    let inQuotes = false;
    const fields: string[] = [];

    for (let i = 0; i < content.length; i++) {
      const ch = content[i];

      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < content.length && content[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current);
          current = '';
        } else if (ch === '\n') {
          fields.push(current);
          current = '';
          if (fields.some((f) => f.trim() !== '')) {
            lines.push([...fields]);
          }
          fields.length = 0;
        } else {
          current += ch;
        }
      }
    }

    // Handle last line without trailing newline
    fields.push(current);
    if (fields.some((f) => f.trim() !== '')) {
      lines.push([...fields]);
    }

    return lines;
  }
}
