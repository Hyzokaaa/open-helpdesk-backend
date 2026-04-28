import { MigrationInterface, QueryRunner } from "typeorm";
import { ulid } from "ulid";

export class CreateAccountsForExistingUsers1777356203836 implements MigrationInterface {
    name = 'CreateAccountsForExistingUsers1777356203836'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const users = await queryRunner.query(
            `SELECT u."id", u."firstName"
             FROM "users" u
             LEFT JOIN "accounts" a ON a."ownerId" = u."id"
             WHERE a."id" IS NULL`
        );

        for (const user of users) {
            await queryRunner.query(
                `INSERT INTO "accounts" ("id", "ownerId", "name", "createdAt", "updatedAt")
                 VALUES ($1, $2, $3, NOW(), NOW())`,
                [ulid(), user.id, `${user.firstName}'s Account`]
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No-op: removing accounts retroactively is destructive
    }
}
