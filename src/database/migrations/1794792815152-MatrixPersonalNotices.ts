import { MigrationInterface, QueryRunner } from "typeorm";

export class MatrixPersonalNotices1794792815152 implements MigrationInterface {
    name = 'MatrixPersonalNotices1794792815152'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "matrix_room_creations" ("id" character varying NOT NULL, "workspaceId" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_2bc75887052a2727b70091cacc1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0381f58c6084cf341e802cccce" ON "matrix_room_creations" ("workspaceId", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "matrix_identities" ("id" character varying NOT NULL, "userId" character varying NOT NULL, "matrixUserId" character varying, "verifiedAt" TIMESTAMP WITH TIME ZONE, "codeHash" character varying, "codeExpiresAt" TIMESTAMP WITH TIME ZONE, "codeAttempts" integer NOT NULL DEFAULT '0', "codeSentAt" TIMESTAMP WITH TIME ZONE, "codeSends" integer NOT NULL DEFAULT '0', "sendWindowStartedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_c272b76532e315f2f287947aff4" UNIQUE ("userId"), CONSTRAINT "PK_987d1f69a030d0093ccf43a4d8c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "matrix_direct_rooms" ("id" character varying NOT NULL, "botId" character varying NOT NULL, "userId" character varying NOT NULL, "matrixUserId" character varying NOT NULL, "roomId" character varying NOT NULL, "lostAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_e91c353425bf05994a8f4c97b45" UNIQUE ("botId", "userId"), CONSTRAINT "PK_c5c0517026305c402a049982cee" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "matrixEnabled" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "matrixTicketCreated" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "matrixTicketAssigned" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "matrixStatusChanged" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "matrixTicketUnassigned" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "matrixCommentCreated" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "matrixTransferRequest" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD "matrixUnattendedReply" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "matrix_room_creations" ADD CONSTRAINT "FK_6a139c377a3e3a438e1c39a8148" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "matrix_identities" ADD CONSTRAINT "FK_c272b76532e315f2f287947aff4" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "matrix_direct_rooms" ADD CONSTRAINT "FK_18f078e742064564b0fd9225fa8" FOREIGN KEY ("botId") REFERENCES "matrix_bots"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "matrix_direct_rooms" ADD CONSTRAINT "FK_e8ab89ac20cedbb23a518232d0d" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "matrix_direct_rooms" DROP CONSTRAINT "FK_e8ab89ac20cedbb23a518232d0d"`);
        await queryRunner.query(`ALTER TABLE "matrix_direct_rooms" DROP CONSTRAINT "FK_18f078e742064564b0fd9225fa8"`);
        await queryRunner.query(`ALTER TABLE "matrix_identities" DROP CONSTRAINT "FK_c272b76532e315f2f287947aff4"`);
        await queryRunner.query(`ALTER TABLE "matrix_room_creations" DROP CONSTRAINT "FK_6a139c377a3e3a438e1c39a8148"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "matrixUnattendedReply"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "matrixTransferRequest"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "matrixCommentCreated"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "matrixTicketUnassigned"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "matrixStatusChanged"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "matrixTicketAssigned"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "matrixTicketCreated"`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP COLUMN "matrixEnabled"`);
        await queryRunner.query(`DROP TABLE "matrix_direct_rooms"`);
        await queryRunner.query(`DROP TABLE "matrix_identities"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0381f58c6084cf341e802cccce"`);
        await queryRunner.query(`DROP TABLE "matrix_room_creations"`);
    }

}
