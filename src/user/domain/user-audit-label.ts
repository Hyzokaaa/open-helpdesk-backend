import { UserRepository } from './repositories/user.repository';

/** A person as the audit log shows them, "Name (email)"; null when unknown. */
export type DescribeUser = (userId: string) => Promise<string | null>;

/** Describes people as the audit log stores them, "Name (email)", so entries read without lookups. */
export function userAuditLabel(users: UserRepository): DescribeUser {
  return async (userId: string): Promise<string | null> => {
    const user = await users.findById(userId);
    return user ? `${user.firstName} ${user.lastName} (${user.email})` : null;
  };
}
