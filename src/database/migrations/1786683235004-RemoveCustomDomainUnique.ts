import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveCustomDomainUnique1786683235004 implements MigrationInterface {
    name = 'RemoveCustomDomainUnique1786683235004'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" DROP CONSTRAINT "UQ_a92154598d9c25552a907989e37"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" ADD CONSTRAINT "UQ_a92154598d9c25552a907989e37" UNIQUE ("customDomain")`);
    }

}
