import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInvitationLastSentAt1791515303087 implements MigrationInterface {
    name = 'AddInvitationLastSentAt1791515303087'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspace_invitations" ADD "lastSentAt" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspace_invitations" DROP COLUMN "lastSentAt"`);
    }

}
