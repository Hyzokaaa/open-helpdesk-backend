import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameReporterRoleToUser1788363778324 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE workspace_members SET role = 'user' WHERE role = 'reporter'`);
        await queryRunner.query(`UPDATE workspace_invitations SET role = 'user' WHERE role = 'reporter'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE workspace_members SET role = 'reporter' WHERE role = 'user'`);
        await queryRunner.query(`UPDATE workspace_invitations SET role = 'reporter' WHERE role = 'user'`);
    }
}
