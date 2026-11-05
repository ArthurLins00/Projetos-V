## O que muda

<!-- Resumo da mudança e issue relacionada (Closes #N) -->

## Testes

- [ ] Testes novos ou alterados para o comportamento desta mudança
- [ ] Casos registrados no catálogo do `TESTES.md` (o job **Política da TAS** confere os arquivos)
- [ ] Novos casos com TC no plano de testes (`docs/testes/Template_Plano_de_Testes_e_Backlog.md`), quando for funcionalidade nova

## Manutenção da TAS (docs/tas.md)

- [ ] Nenhum teste desligado (`.skip`, `.fixme`, `pending/`) sem registro em `.github/tas/quarentena.json` e issue
- [ ] Se este PR corrige uma falha: a issue tem a classificação (`sut`, `tas`, `ambiente` ou `variação esperada`) e a causa
- [ ] Se remove um teste: a issue de remoção tem as duas aprovações (seção 7)
