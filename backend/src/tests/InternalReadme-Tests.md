# 🧪 Guia de Contribuição: Testes Automatizados

Este repositório/branch utiliza o fluxo de trabalho baseado em **Forks** e **Feature Branches** para garantir a organização e a qualidade da nossa suíte de testes.

Siga os passos abaixo para criar e enviar o seu teste automatizado sem gerar conflitos com as alterações dos outros membros do time.

---

## 📌 Regra Principal

* **Cenários Únicos:** Cada membro do time deve criar **um teste diferente**. Combine com a equipe ou verifique o painel do projeto (Ex: Jira/Trello/Issues) antes de iniciar para garantir que ninguém esteja testando o mesmo fluxo ou alterando o mesmo arquivo.

---

## 🚀 Passo a Passo para Contribuir

### 1. Atualizar seu Repositório Local

Garanta que as referências do repositório principal (`upstream`) estejam atualizadas na sua máquina:

```bash
# Baixa as novidades do repositório principal
git fetch upstream

# Entra na branch base de testes
git checkout feat/automated-tests || git checkout -b feat/automated-tests upstream/feat/automated-tests

# Garante que sua cópia local está atualizada
git pull upstream feat/automated-tests
```

---

### 2. Criar sua Feature Branch

**Não faça alterações diretamente na branch `feat/automated-tests`.** Crie uma branch própria para o seu teste a partir dela:

```bash
# Padrão de nome: test/nome-da-funcionalidade
git checkout -b test/meu-novo-teste
```

---

### 3. Escrever e Salvar o Teste

1. Adicione ou edite o seu arquivo de teste dentro do repositório.
2. Salve as alterações com um commit claro:

```bash
git add .
git commit -m "feat(testes): adiciona teste para [nome da funcionalidade]"
```

---

### 4. Enviar a Branch para o seu Fork (`origin`)

Envie a sua branch de trabalho para o seu repositório pessoal no GitHub:

```bash
git push -u origin test/meu-novo-teste
```

---

### 5. Abrir o Pull Request (PR)

1. Acesse a página do repositório principal (**upstream**) no GitHub.
2. Clique no botão **New Pull Request**.
3. Configure os destinos corretamente:
   * **Base repository:** Repositório Principal (`upstream`)
   * **Base branch:** `feat/automated-tests`
   * **Head repository:** Seu Fork (`origin`)
   * **Compare branch:** `test/meu-novo-teste`
4. Adicione um título e uma breve descrição explicando o que o seu teste valida e abra o PR.

---

## 🔄 O que fazer em caso de conflitos?

Se outro Pull Request for aprovado antes do seu, atualize sua branch com as mudanças mais recentes do `upstream` antes de realizar o merge:

```bash
# Garanta que está na sua branch de teste
git checkout test/meu-novo-teste

# Puxa as atualizações mais recentes do upstream
git pull upstream feat/automated-tests

# Caso haja conflito, resolva-o no editor de código, salve e faça o commit
# Em seguida, envie de volta para o seu fork
git push origin test/meu-novo-teste
```

---

## ✅ Checklist do Pull Request

Antes de enviar, certifique-se de que:
- [ ] O teste está rodando e passando localmente.
- [ ] O arquivo do teste não sobrescreve testes criados por outros membros.
- [ ] O PR está direcionado para a branch **`feat/automated-tests`** do `upstream`.
