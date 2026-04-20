import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNotificationTables1776648306192 implements MigrationInterface {
    name = 'AddNotificationTables1776648306192'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "notifications" ("id" character varying NOT NULL, "userId" character varying NOT NULL, "type" character varying NOT NULL, "title" character varying NOT NULL, "ticketId" character varying, "workspaceSlug" character varying NOT NULL, "isRead" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5340fc241f57310d243e5ab20b" ON "notifications" ("userId", "isRead") `);
        await queryRunner.query(`CREATE TABLE "notification_preferences" ("id" character varying NOT NULL, "userId" character varying NOT NULL, "emailEnabled" boolean NOT NULL DEFAULT true, "inAppEnabled" boolean NOT NULL DEFAULT true, "emailTicketCreated" boolean NOT NULL DEFAULT true, "emailTicketAssigned" boolean NOT NULL DEFAULT true, "emailStatusChanged" boolean NOT NULL DEFAULT true, "emailCommentCreated" boolean NOT NULL DEFAULT true, "inAppTicketCreated" boolean NOT NULL DEFAULT true, "inAppTicketAssigned" boolean NOT NULL DEFAULT true, "inAppStatusChanged" boolean NOT NULL DEFAULT true, "inAppCommentCreated" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_b70c44e8b00757584a393225593" UNIQUE ("userId"), CONSTRAINT "PK_e94e2b543f2f218ee68e4f4fad2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notification_preferences" ADD CONSTRAINT "FK_b70c44e8b00757584a393225593" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notification_preferences" DROP CONSTRAINT "FK_b70c44e8b00757584a393225593"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_692a909ee0fa9383e7859f9b406"`);
        await queryRunner.query(`DROP TABLE "notification_preferences"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5340fc241f57310d243e5ab20b"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
    }

}
