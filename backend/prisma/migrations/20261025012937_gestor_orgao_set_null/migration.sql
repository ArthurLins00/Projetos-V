-- DropForeignKey
ALTER TABLE "gestor" DROP CONSTRAINT "gestor_orgaoid_fkey";

-- AddForeignKey
ALTER TABLE "gestor" ADD CONSTRAINT "gestor_orgaoid_fkey" FOREIGN KEY ("orgaoid") REFERENCES "orgao"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
