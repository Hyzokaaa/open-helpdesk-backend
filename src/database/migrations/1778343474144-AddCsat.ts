import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCsat1778343474144 implements MigrationInterface {
    name = 'AddCsat1778343474144'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "csat_responses" ("id" character varying NOT NULL, "ticketId" character varying NOT NULL, "workspaceId" character varying NOT NULL, "token" character varying NOT NULL, "rating" character varying, "respondedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_a03060eb0eca1daa1bd4d675366" UNIQUE ("ticketId"), CONSTRAINT "UQ_bae893c2fbce98aa2ec75bcaaeb" UNIQUE ("token"), CONSTRAINT "PK_4492ac3e2dfa2729bc1d2958078" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "csat_responses" ADD CONSTRAINT "FK_a03060eb0eca1daa1bd4d675366" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "csat_responses" ADD CONSTRAINT "FK_12cd4f295134ea212b491ccc9af" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "csat_responses" DROP CONSTRAINT "FK_12cd4f295134ea212b491ccc9af"`);
        await queryRunner.query(`ALTER TABLE "csat_responses" DROP CONSTRAINT "FK_a03060eb0eca1daa1bd4d675366"`);
        await queryRunner.query(`DROP TABLE "csat_responses"`);
    }

}
