import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDepartments1786320670245 implements MigrationInterface {
    name = 'AddDepartments1786320670245'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "departments" ("id" character varying NOT NULL, "name" character varying NOT NULL, "description" character varying, "workspaceId" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_839517a681a86bb84cbcc6a1e9d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "department_members" ("id" character varying NOT NULL, "departmentId" character varying NOT NULL, "userId" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_ee5fe8ffdb0036702aa4b3d9154" UNIQUE ("departmentId", "userId"), CONSTRAINT "PK_88e8868d7c4c4ba3673df9b7cef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "departmentId" character varying`);
        await queryRunner.query(`ALTER TABLE "departments" ADD CONSTRAINT "FK_574c2f2b7f88862f739e0cbd6c4" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_16b65d315fcf774ad6c824430c2" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "department_members" ADD CONSTRAINT "FK_0b77929bf520d312a4528b9fc3c" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "department_members" ADD CONSTRAINT "FK_a8df9864386b587368cc2c747ef" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "department_members" DROP CONSTRAINT "FK_a8df9864386b587368cc2c747ef"`);
        await queryRunner.query(`ALTER TABLE "department_members" DROP CONSTRAINT "FK_0b77929bf520d312a4528b9fc3c"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_16b65d315fcf774ad6c824430c2"`);
        await queryRunner.query(`ALTER TABLE "departments" DROP CONSTRAINT "FK_574c2f2b7f88862f739e0cbd6c4"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "departmentId"`);
        await queryRunner.query(`DROP TABLE "department_members"`);
        await queryRunner.query(`DROP TABLE "departments"`);
    }

}
