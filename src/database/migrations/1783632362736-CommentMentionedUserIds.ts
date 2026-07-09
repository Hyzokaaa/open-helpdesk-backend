import { MigrationInterface, QueryRunner } from "typeorm";

export class CommentMentionedUserIds1783632362736 implements MigrationInterface {
    name = 'CommentMentionedUserIds1783632362736'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comments" ADD "mentionedUserIds" text NOT NULL DEFAULT ''`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN "mentionedUserIds"`);
    }

}
