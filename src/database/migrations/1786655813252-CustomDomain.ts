import { MigrationInterface, QueryRunner } from "typeorm";

export class CustomDomain1786655813252 implements MigrationInterface {
    name = 'CustomDomain1786655813252'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "customDomain" character varying`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD CONSTRAINT "UQ_a92154598d9c25552a907989e37" UNIQUE ("customDomain")`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "customDomainVerified" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "workspaces" ADD "domainVerificationToken" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "domainVerificationToken"`);
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "customDomainVerified"`);
        await queryRunner.query(`ALTER TABLE "workspaces" DROP CONSTRAINT "UQ_a92154598d9c25552a907989e37"`);
        await queryRunner.query(`ALTER TABLE "workspaces" DROP COLUMN "customDomain"`);
    }

}
