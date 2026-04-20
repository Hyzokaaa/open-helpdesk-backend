import { MigrationInterface, QueryRunner } from "typeorm";

export class UseTimestamptz1776666537496 implements MigrationInterface {
    name = 'UseTimestamptz1776666537496'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workspaces" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "workspaces" ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "workspace_members" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "tags" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "deletedAt" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "comments" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "comments" ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "attachments" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" ALTER COLUMN "updatedAt" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ALTER COLUMN "createdAt" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "notifications" ALTER COLUMN "createdAt" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "attachments" ALTER COLUMN "createdAt" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "comments" ALTER COLUMN "updatedAt" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "comments" ALTER COLUMN "createdAt" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "deletedAt" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "updatedAt" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "tickets" ALTER COLUMN "createdAt" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "tags" ALTER COLUMN "createdAt" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "workspace_members" ALTER COLUMN "createdAt" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "updatedAt" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "createdAt" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "workspaces" ALTER COLUMN "updatedAt" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "workspaces" ALTER COLUMN "createdAt" TYPE TIMESTAMP`);
    }

}
