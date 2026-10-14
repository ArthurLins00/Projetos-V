-- Gestores deixam de ser vinculados a um órgão: um único perfil de gestor atende todos os chamados
ALTER TABLE "gestor" ALTER COLUMN "orgaoid" DROP NOT NULL;

UPDATE "gestor" SET "orgaoid" = NULL;

-- Remove as contas de gestor por órgão (gestor.<orgao>@fiscalize.gov.br)
UPDATE "chamado" SET "gestorid" = NULL
WHERE "gestorid" IN (SELECT "id" FROM "usuario" WHERE "email" LIKE 'gestor.%@fiscalize.gov.br');

DELETE FROM "usuario_audit"
WHERE "usuarioid" IN (SELECT "id" FROM "usuario" WHERE "email" LIKE 'gestor.%@fiscalize.gov.br');

DELETE FROM "usuario" WHERE "email" LIKE 'gestor.%@fiscalize.gov.br';
