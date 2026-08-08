import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameCreatorToReporter1786145462424 implements MigrationInterface {
    name = 'RenameCreatorToReporter1786145462424'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_63feb59883a12a746bcb870b761"`);
        await queryRunner.query(`ALTER TABLE "tickets" RENAME COLUMN "creatorId" TO "reporterId"`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_b1930f86a5e9b5b5be3689fc820" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_b1930f86a5e9b5b5be3689fc820"`);
        await queryRunner.query(`ALTER TABLE "tickets" RENAME COLUMN "reporterId" TO "creatorId"`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_63feb59883a12a746bcb870b761" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
