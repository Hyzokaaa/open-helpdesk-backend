import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUploadedByToAttachments1777868807735 implements MigrationInterface {
    name = 'AddUploadedByToAttachments1777868807735'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attachments" ADD "uploadedById" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attachments" DROP COLUMN "uploadedById"`);
    }

}
