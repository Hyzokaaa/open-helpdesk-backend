import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOnboardingStepSkips1792030624228 implements MigrationInterface {
    name = 'AddOnboardingStepSkips1792030624228'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "onboarding_step_skips" ("id" character varying NOT NULL, "userId" character varying NOT NULL, "step" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_65a74677f05af0a52bf70a571e3" UNIQUE ("userId", "step"), CONSTRAINT "PK_3b2fe9f60124b5e9d2d328607be" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "onboarding_step_skips" ADD CONSTRAINT "FK_e96131471aad30ecd800ba23cab" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "onboarding_step_skips" DROP CONSTRAINT "FK_e96131471aad30ecd800ba23cab"`);
        await queryRunner.query(`DROP TABLE "onboarding_step_skips"`);
    }

}
