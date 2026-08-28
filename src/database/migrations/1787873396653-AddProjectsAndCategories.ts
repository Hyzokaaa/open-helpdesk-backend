import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProjectsAndCategories1787873396653 implements MigrationInterface {
    name = 'AddProjectsAndCategories1787873396653'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "projects" ("id" character varying NOT NULL, "name" character varying NOT NULL, "description" character varying, "workspaceId" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ticket_categories" ("id" character varying NOT NULL, "name" character varying NOT NULL, "slug" character varying NOT NULL, "color" character varying NOT NULL DEFAULT 'blue', "workspaceId" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6e0ee8248a3915067d3f4b64b10" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "project_categories" ("projectId" character varying NOT NULL, "categoryId" character varying NOT NULL, CONSTRAINT "PK_7a31ae0114fb257b092ee940ad0" PRIMARY KEY ("projectId", "categoryId"))`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "categoryId" character varying`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "projectId" character varying`);

        // Seed default categories per workspace
        const workspaces = await queryRunner.query(`SELECT id FROM workspaces`);
        const defaults = [
            { name: 'Bug', slug: 'bug', color: 'red' },
            { name: 'Feature Request', slug: 'feature-request', color: 'green' },
            { name: 'Issue', slug: 'issue', color: 'yellow' },
            { name: 'Task', slug: 'task', color: 'blue' },
        ];
        for (const ws of workspaces) {
            for (const def of defaults) {
                const id = require('ulid').ulid();
                await queryRunner.query(
                    `INSERT INTO "ticket_categories" ("id", "name", "slug", "color", "workspaceId") VALUES ($1, $2, $3, $4, $5)`,
                    [id, def.name, def.slug, def.color, ws.id],
                );
            }
        }

        // Map existing category string to categoryId FK
        await queryRunner.query(`
            UPDATE "tickets" t
            SET "categoryId" = tc."id"
            FROM "ticket_categories" tc
            WHERE tc."slug" = t."category"
            AND tc."workspaceId" = t."workspaceId"
        `);

        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "category"`);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_108ff8a2d40c2b294511c92a7c8" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket_categories" ADD CONSTRAINT "FK_464b37a22fa32ac8410ec60e148" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_f47458a36c743b14e0371b70a6e" FOREIGN KEY ("categoryId") REFERENCES "ticket_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_7ea2738d6dd730beda6fc2f2b46" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_categories" ADD CONSTRAINT "FK_4b3ae99beef33e732fb63185009" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "project_categories" ADD CONSTRAINT "FK_1c3ef809362ea005697d86e8288" FOREIGN KEY ("categoryId") REFERENCES "ticket_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "project_categories" DROP CONSTRAINT "FK_1c3ef809362ea005697d86e8288"`);
        await queryRunner.query(`ALTER TABLE "project_categories" DROP CONSTRAINT "FK_4b3ae99beef33e732fb63185009"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_7ea2738d6dd730beda6fc2f2b46"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_f47458a36c743b14e0371b70a6e"`);
        await queryRunner.query(`ALTER TABLE "ticket_categories" DROP CONSTRAINT "FK_464b37a22fa32ac8410ec60e148"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_108ff8a2d40c2b294511c92a7c8"`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "category" character varying NOT NULL DEFAULT 'issue'`);
        await queryRunner.query(`
            UPDATE "tickets" t
            SET "category" = COALESCE(tc."slug", 'issue')
            FROM "ticket_categories" tc
            WHERE tc."id" = t."categoryId"
        `);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "projectId"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "categoryId"`);
        await queryRunner.query(`DROP TABLE "project_categories"`);
        await queryRunner.query(`DROP TABLE "ticket_categories"`);
        await queryRunner.query(`DROP TABLE "projects"`);
    }

}
