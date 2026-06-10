import { MigrationInterface, QueryRunner } from "typeorm";

export class AddApiKeysAndWebhooks1781047066182 implements MigrationInterface {
    name = 'AddApiKeysAndWebhooks1781047066182'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "webhooks" ("id" character varying NOT NULL, "workspaceId" character varying NOT NULL, "url" character varying NOT NULL, "events" text NOT NULL, "secret" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9e8795cfc899ab7bdaa831e8527" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "api_keys" ("id" character varying NOT NULL, "workspaceId" character varying NOT NULL, "name" character varying NOT NULL, "key" character varying NOT NULL, "prefix" character varying NOT NULL, "lastUsedAt" TIMESTAMP WITH TIME ZONE, "createdById" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_e42cf55faeafdcce01a82d24849" UNIQUE ("key"), CONSTRAINT "PK_5c8a79801b44bd27b79228e1dad" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "webhooks" ADD CONSTRAINT "FK_c7fbad6194e2e2ec9f2af1412a9" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "api_keys" ADD CONSTRAINT "FK_da0383f8ff714f82352b8f29bd8" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "api_keys" ADD CONSTRAINT "FK_bdf7b6da2e124011d405f5ce831" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "api_keys" DROP CONSTRAINT "FK_bdf7b6da2e124011d405f5ce831"`);
        await queryRunner.query(`ALTER TABLE "api_keys" DROP CONSTRAINT "FK_da0383f8ff714f82352b8f29bd8"`);
        await queryRunner.query(`ALTER TABLE "webhooks" DROP CONSTRAINT "FK_c7fbad6194e2e2ec9f2af1412a9"`);
        await queryRunner.query(`DROP TABLE "api_keys"`);
        await queryRunner.query(`DROP TABLE "webhooks"`);
    }

}
