import { MigrationInterface, QueryRunner } from "typeorm";

export class AddKnowledgeBase1785211817325 implements MigrationInterface {
    name = 'AddKnowledgeBase1785211817325'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "kb_categories" ("id" character varying NOT NULL, "name" character varying NOT NULL, "slug" character varying NOT NULL, "icon" character varying, "position" integer NOT NULL DEFAULT '0', "workspaceId" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_dc7cbd5fc1cf6a5629789b47300" UNIQUE ("workspaceId", "slug"), CONSTRAINT "PK_b45b2b3fa8645a80ddcb72cdb16" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "kb_articles" ("id" character varying NOT NULL, "title" character varying NOT NULL, "slug" character varying NOT NULL, "content" text NOT NULL, "status" character varying NOT NULL DEFAULT 'draft', "position" integer NOT NULL DEFAULT '0', "categoryId" character varying NOT NULL, "workspaceId" character varying NOT NULL, "createdById" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_3cc913e05272c33a5d149152504" UNIQUE ("workspaceId", "slug"), CONSTRAINT "PK_ffb01b096d72350aa97d1d0cb14" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "kb_categories" ADD CONSTRAINT "FK_d70b26ad67e518d6b97120e1aa6" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "kb_articles" ADD CONSTRAINT "FK_2cb85c4826935e8f08312730250" FOREIGN KEY ("categoryId") REFERENCES "kb_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "kb_articles" ADD CONSTRAINT "FK_5fa5d60f43c2fa8f38c7ce122b6" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "kb_articles" ADD CONSTRAINT "FK_d645f9d4012c64aadbbedbebf41" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "kb_articles" DROP CONSTRAINT "FK_d645f9d4012c64aadbbedbebf41"`);
        await queryRunner.query(`ALTER TABLE "kb_articles" DROP CONSTRAINT "FK_5fa5d60f43c2fa8f38c7ce122b6"`);
        await queryRunner.query(`ALTER TABLE "kb_articles" DROP CONSTRAINT "FK_2cb85c4826935e8f08312730250"`);
        await queryRunner.query(`ALTER TABLE "kb_categories" DROP CONSTRAINT "FK_d70b26ad67e518d6b97120e1aa6"`);
        await queryRunner.query(`DROP TABLE "kb_articles"`);
        await queryRunner.query(`DROP TABLE "kb_categories"`);
    }

}
