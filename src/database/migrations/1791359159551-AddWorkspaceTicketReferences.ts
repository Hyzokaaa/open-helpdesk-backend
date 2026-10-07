import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkspaceTicketReferences1791359159551 implements MigrationInterface {
    name = 'AddWorkspaceTicketReferences1791359159551'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "workspace_ticket_references" ("workspaceId" character varying NOT NULL, "style" character varying(20) NOT NULL DEFAULT 'sequential', "prefix" character varying(10) NOT NULL DEFAULT 'TK', "secret" character varying(64), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f184275838401e9128c272a91e1" PRIMARY KEY ("workspaceId"))`);
        await queryRunner.query(`ALTER TABLE "workspace_ticket_references" ADD CONSTRAINT "FK_f184275838401e9128c272a91e1" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspace_ticket_references" DROP CONSTRAINT "FK_f184275838401e9128c272a91e1"`);
        await queryRunner.query(`DROP TABLE "workspace_ticket_references"`);
    }

}
