import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAccounts1777186161138 implements MigrationInterface {
    name = 'AddAccounts1777186161138'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "accounts" ("id" character varying NOT NULL, "ownerId" character varying NOT NULL, "name" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_2cb7f7a1dc3b84c8cde2b930944" UNIQUE ("ownerId"), CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "accountId" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "accountId"`);
        await queryRunner.query(`DROP TABLE "accounts"`);
    }

}
