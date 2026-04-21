import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCascadeDeletes1776794885502 implements MigrationInterface {
    name = 'AddCascadeDeletes1776794885502'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspace_members" DROP CONSTRAINT "FK_0dd45cb52108d0664df4e7e33e6"`);
        await queryRunner.query(`ALTER TABLE "tags" DROP CONSTRAINT "FK_d31ad143044deb9e8e8a19a72f0"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_acd2902f8d3e072cec62b960637"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_469fc1a5c6798a3b7a6de4dfc6e"`);
        await queryRunner.query(`ALTER TABLE "attachments" DROP CONSTRAINT "FK_14abf06f2a9b9233a64747c0f19"`);
        await queryRunner.query(`ALTER TABLE "attachments" DROP CONSTRAINT "FK_8921695e038fc28b5d08d431ea6"`);
        await queryRunner.query(`ALTER TABLE "workspace_members" ADD CONSTRAINT "FK_0dd45cb52108d0664df4e7e33e6" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tags" ADD CONSTRAINT "FK_d31ad143044deb9e8e8a19a72f0" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_acd2902f8d3e072cec62b960637" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_469fc1a5c6798a3b7a6de4dfc6e" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attachments" ADD CONSTRAINT "FK_14abf06f2a9b9233a64747c0f19" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attachments" ADD CONSTRAINT "FK_8921695e038fc28b5d08d431ea6" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "attachments" DROP CONSTRAINT "FK_8921695e038fc28b5d08d431ea6"`);
        await queryRunner.query(`ALTER TABLE "attachments" DROP CONSTRAINT "FK_14abf06f2a9b9233a64747c0f19"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_469fc1a5c6798a3b7a6de4dfc6e"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_acd2902f8d3e072cec62b960637"`);
        await queryRunner.query(`ALTER TABLE "tags" DROP CONSTRAINT "FK_d31ad143044deb9e8e8a19a72f0"`);
        await queryRunner.query(`ALTER TABLE "workspace_members" DROP CONSTRAINT "FK_0dd45cb52108d0664df4e7e33e6"`);
        await queryRunner.query(`ALTER TABLE "attachments" ADD CONSTRAINT "FK_8921695e038fc28b5d08d431ea6" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "attachments" ADD CONSTRAINT "FK_14abf06f2a9b9233a64747c0f19" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_469fc1a5c6798a3b7a6de4dfc6e" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_acd2902f8d3e072cec62b960637" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tags" ADD CONSTRAINT "FK_d31ad143044deb9e8e8a19a72f0" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workspace_members" ADD CONSTRAINT "FK_0dd45cb52108d0664df4e7e33e6" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
