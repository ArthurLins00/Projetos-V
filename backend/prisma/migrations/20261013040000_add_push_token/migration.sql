-- CreateTable
CREATE TABLE "push_token" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "usuarioid" UUID NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "criadoem" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_token_token_key" ON "push_token"("token");

-- CreateIndex
CREATE INDEX "idx_push_token_usuario" ON "push_token"("usuarioid");

-- AddForeignKey
ALTER TABLE "push_token" ADD CONSTRAINT "push_token_usuarioid_fkey" FOREIGN KEY ("usuarioid") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
