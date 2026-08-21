import { MigrationInterface, QueryRunner } from "typeorm";

export class Organizations1787263034692 implements MigrationInterface {
    name = 'Organizations1787263034692'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "organizations" ("id" character varying NOT NULL, "name" character varying NOT NULL, "description" character varying, "logo" character varying, "domains" jsonb NOT NULL DEFAULT '[]', "workspaceId" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "organizations" ADD CONSTRAINT "FK_24ca7f01d15ad5188a922ad7004" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "organizations" DROP CONSTRAINT "FK_24ca7f01d15ad5188a922ad7004"`);
        await queryRunner.query(`DROP TABLE "organizations"`);
    }

}
