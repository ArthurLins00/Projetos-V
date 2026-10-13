-- CreateEnum
CREATE TYPE "zona" AS ENUM ('Urbana', 'Rural');

-- AlterTable
ALTER TABLE "chamado" ADD COLUMN "uf" VARCHAR(2),
ADD COLUMN "cidade" VARCHAR(100),
ADD COLUMN "zona" "zona";
