-- CreateTable
CREATE TABLE "chamado_foto" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "chamadoid" UUID NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "criadoem" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chamado_foto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_chamado_foto_chamado" ON "chamado_foto"("chamadoid", "criadoem");

-- AddForeignKey
ALTER TABLE "chamado_foto" ADD CONSTRAINT "chamado_foto_chamadoid_fkey" FOREIGN KEY ("chamadoid") REFERENCES "chamado"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AlterTable
ALTER TABLE "chamado" DROP COLUMN "fotourl";
