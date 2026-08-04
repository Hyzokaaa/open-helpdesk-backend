import { MigrationInterface, QueryRunner } from "typeorm";

export class SystemMailbox1785849533867 implements MigrationInterface {
    name = 'SystemMailbox1785849533867'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP CONSTRAINT "FK_0a6b093ccb7700e3c2c68a0f536"`);
        await queryRunner.query(`ALTER TABLE "mailboxes" ALTER COLUMN "workspaceId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD CONSTRAINT "FK_0a6b093ccb7700e3c2c68a0f536" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mailboxes" DROP CONSTRAINT "FK_0a6b093ccb7700e3c2c68a0f536"`);
        await queryRunner.query(`ALTER TABLE "mailboxes" ALTER COLUMN "workspaceId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "mailboxes" ADD CONSTRAINT "FK_0a6b093ccb7700e3c2c68a0f536" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
