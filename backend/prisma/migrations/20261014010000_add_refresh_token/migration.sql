-- CreateTable
CREATE TABLE "refresh_token" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "usuarioid" UUID NOT NULL,
    "tokenhash" CHAR(64) NOT NULL,
    "expiraem" TIMESTAMP(6) NOT NULL,
    "revogadoem" TIMESTAMP(6),
    "criadoem" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_tokenhash_key" ON "refresh_token"("tokenhash");

-- CreateIndex
CREATE INDEX "idx_refresh_token_usuario" ON "refresh_token"("usuarioid");

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_usuarioid_fkey" FOREIGN KEY ("usuarioid") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
