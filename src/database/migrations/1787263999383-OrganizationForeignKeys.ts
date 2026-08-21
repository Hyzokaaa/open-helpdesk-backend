import { MigrationInterface, QueryRunner } from "typeorm";

export class OrganizationForeignKeys1787263999383 implements MigrationInterface {
    name = 'OrganizationForeignKeys1787263999383'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspace_members" ADD "organizationId" character varying`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "organizationId" character varying`);
        await queryRunner.query(`ALTER TABLE "workspace_members" ADD CONSTRAINT "FK_95823ef21d0dcb67b799b40e9b1" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_98f00985a13412ab11f4d1c1000" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_98f00985a13412ab11f4d1c1000"`);
        await queryRunner.query(`ALTER TABLE "workspace_members" DROP CONSTRAINT "FK_95823ef21d0dcb67b799b40e9b1"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "organizationId"`);
        await queryRunner.query(`ALTER TABLE "workspace_members" DROP COLUMN "organizationId"`);
    }

}
