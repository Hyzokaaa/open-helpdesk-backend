import { MigrationInterface, QueryRunner } from "typeorm";

export class AddResolvedById1778335183440 implements MigrationInterface {
    name = 'AddResolvedById1778335183440'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" ADD "resolvedById" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "resolvedById"`);
    }

}
