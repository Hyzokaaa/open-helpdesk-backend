import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1776581312974 implements MigrationInterface {
    name = 'InitialSchema1776581312974'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "workspaces" ("id" character varying NOT NULL, "name" character varying NOT NULL, "slug" character varying NOT NULL, "description" character varying NOT NULL DEFAULT '', "dealerId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_b8e9fe62e93d60089dfc4f175f3" UNIQUE ("slug"), CONSTRAINT "PK_098656ae401f3e1a4586f47fd8e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" character varying NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "isSystemAdmin" boolean NOT NULL DEFAULT false, "language" character varying NOT NULL DEFAULT 'en', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "workspace_members" ("id" character varying NOT NULL, "workspaceId" character varying NOT NULL, "userId" character varying NOT NULL, "role" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_99bcb5fdac446371d41f048b24f" UNIQUE ("workspaceId", "userId"), CONSTRAINT "PK_22ab43ac5865cd62769121d2bc4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tags" ("id" character varying NOT NULL, "name" character varying NOT NULL, "color" character varying, "workspaceId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e7dc17249a1148a1970748eda99" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tickets" ("id" character varying NOT NULL, "name" character varying NOT NULL, "description" text NOT NULL, "priority" character varying NOT NULL, "status" character varying NOT NULL, "category" character varying NOT NULL, "workspaceId" character varying NOT NULL, "creatorId" character varying NOT NULL, "assigneeId" character varying, "resolvedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_343bc942ae261cf7a1377f48fd0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "comments" ("id" character varying NOT NULL, "content" text NOT NULL, "ticketId" character varying NOT NULL, "authorId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "attachments" ("id" character varying NOT NULL, "fileName" character varying NOT NULL, "originalName" character varying NOT NULL, "mimeType" character varying NOT NULL, "size" integer NOT NULL, "s3Key" character varying NOT NULL, "ticketId" character varying, "commentId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5e1f050bcff31e3084a1d662412" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ticket_tag" ("ticketsId" character varying NOT NULL, "tagsId" character varying NOT NULL, CONSTRAINT "PK_728974f203b39fbd918379e7e6b" PRIMARY KEY ("ticketsId", "tagsId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b8f18131c7c42ec165f9854226" ON "ticket_tag" ("ticketsId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c2e2cf09ab5546f21affdd8a4e" ON "ticket_tag" ("tagsId") `);
        await queryRunner.query(`ALTER TABLE "workspace_members" ADD CONSTRAINT "FK_0dd45cb52108d0664df4e7e33e6" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workspace_members" ADD CONSTRAINT "FK_22176b38813258c2aadaae32448" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tags" ADD CONSTRAINT "FK_d31ad143044deb9e8e8a19a72f0" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_acd2902f8d3e072cec62b960637" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_63feb59883a12a746bcb870b761" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_4f127f7c92139971ec4cbbe0bd5" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_469fc1a5c6798a3b7a6de4dfc6e" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_4548cc4a409b8651ec75f70e280" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attachments" ADD CONSTRAINT "FK_14abf06f2a9b9233a64747c0f19" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attachments" ADD CONSTRAINT "FK_8921695e038fc28b5d08d431ea6" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket_tag" ADD CONSTRAINT "FK_b8f18131c7c42ec165f98542263" FOREIGN KEY ("ticketsId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "ticket_tag" ADD CONSTRAINT "FK_c2e2cf09ab5546f21affdd8a4e0" FOREIGN KEY ("tagsId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_tag" DROP CONSTRAINT "FK_c2e2cf09ab5546f21affdd8a4e0"`);
        await queryRunner.query(`ALTER TABLE "ticket_tag" DROP CONSTRAINT "FK_b8f18131c7c42ec165f98542263"`);
        await queryRunner.query(`ALTER TABLE "attachments" DROP CONSTRAINT "FK_8921695e038fc28b5d08d431ea6"`);
        await queryRunner.query(`ALTER TABLE "attachments" DROP CONSTRAINT "FK_14abf06f2a9b9233a64747c0f19"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_4548cc4a409b8651ec75f70e280"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_469fc1a5c6798a3b7a6de4dfc6e"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_4f127f7c92139971ec4cbbe0bd5"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_63feb59883a12a746bcb870b761"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_acd2902f8d3e072cec62b960637"`);
        await queryRunner.query(`ALTER TABLE "tags" DROP CONSTRAINT "FK_d31ad143044deb9e8e8a19a72f0"`);
        await queryRunner.query(`ALTER TABLE "workspace_members" DROP CONSTRAINT "FK_22176b38813258c2aadaae32448"`);
        await queryRunner.query(`ALTER TABLE "workspace_members" DROP CONSTRAINT "FK_0dd45cb52108d0664df4e7e33e6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c2e2cf09ab5546f21affdd8a4e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b8f18131c7c42ec165f9854226"`);
        await queryRunner.query(`DROP TABLE "ticket_tag"`);
        await queryRunner.query(`DROP TABLE "attachments"`);
        await queryRunner.query(`DROP TABLE "comments"`);
        await queryRunner.query(`DROP TABLE "tickets"`);
        await queryRunner.query(`DROP TABLE "tags"`);
        await queryRunner.query(`DROP TABLE "workspace_members"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "workspaces"`);
    }

}
