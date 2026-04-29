import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkspaceInvitations1777432198269 implements MigrationInterface {
    name = 'AddWorkspaceInvitations1777432198269'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "workspace_invitations" ("id" character varying NOT NULL, "workspaceId" character varying NOT NULL, "email" character varying NOT NULL, "role" character varying NOT NULL, "token" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "invitedById" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_525b9069dc828a8ee8fdc62c32c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "workspace_invitations" ADD CONSTRAINT "FK_65515eaafd8282c3848bddbb008" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workspace_invitations" ADD CONSTRAINT "FK_5d5dd20ac2ce5f9b80d47ea4f09" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspace_invitations" DROP CONSTRAINT "FK_5d5dd20ac2ce5f9b80d47ea4f09"`);
        await queryRunner.query(`ALTER TABLE "workspace_invitations" DROP CONSTRAINT "FK_65515eaafd8282c3848bddbb008"`);
        await queryRunner.query(`DROP TABLE "workspace_invitations"`);
    }

}
