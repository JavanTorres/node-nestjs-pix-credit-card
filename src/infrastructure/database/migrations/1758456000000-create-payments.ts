import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePayments1758456000000 implements MigrationInterface {
  name = 'CreatePayments1758456000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."payments_payment_method_enum" AS ENUM('PIX', 'CREDIT_CARD')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_status_enum" AS ENUM('PENDING', 'PAID', 'FAIL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" (
        "id" uuid NOT NULL,
        "cpf" character(11) NOT NULL,
        "description" character varying(255) NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "payment_method" "public"."payments_payment_method_enum" NOT NULL,
        "status" "public"."payments_status_enum" NOT NULL DEFAULT 'PENDING',
        "external_id" character varying(255),
        "checkout_url" character varying(512),
        "version" integer NOT NULL DEFAULT '0',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payments_cpf" ON "payments" ("cpf")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payments_payment_method" ON "payments" ("payment_method")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payments_status" ON "payments" ("status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_payments_external_id" ON "payments" ("external_id") WHERE "external_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_payments_external_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_payments_status"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_payments_payment_method"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_payments_cpf"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."payments_payment_method_enum"`,
    );
  }
}
