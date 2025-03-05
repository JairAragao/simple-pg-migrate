# Simple Migration SQL

Um sistema simples e genérico de migrations para PostgreSQL. Permite aplicar e reverter migrations de forma controlada, oferecendo flexibilidade para desenvolvimento e manutenção do banco de dados em qualquer aplicação.

## Configuração

1. Instale as dependências necessárias:
   ```bash
   npm install
   ```

2. Renomeie o arquivo `.env.exemple` para `.env` e configure as seguintes variáveis:
   ```
   DB_HOST=seu_host
   DB_PORT=sua_porta
   DB_NAME=nome_do_banco
   DB_USER=seu_usuario
   DB_PASSWORD=sua_senha
   MIGRATIONS_TABLE=tabela_de_migrations
   MIGRATIONS_NAME_COLUMN=coluna_com_nome_das_migrations
   ```

3. Certifique-se de que o arquivo `runMigrations.js` está na raiz do seu projeto.

4. A pasta `migrations` já contém arquivos de exemplo que demonstram o formato correto para criar suas próprias migrations. Você pode usá-los como referência e adicionar novos arquivos seguindo o mesmo padrão.

## Estrutura das Migrations

Cada migration consiste em dois arquivos SQL:

- `XXX_nome_da_migration_up.sql`: Contém as instruções SQL para aplicar a migration.
- `XXX_nome_da_migration_down.sql`: Contém as instruções SQL para reverter a migration.

Exemplo:
- `001_create_users_table_up.sql`
- `001_create_users_table_down.sql`

O prefixo numérico (XXX) determina a ordem de execução das migrations.

## Uso

### Aplicar Migrations

Para aplicar todas as migrations pendentes:
```bash
npm run migrate:up
```

Para aplicar migrations até uma versão específica:
```bash
npm run migrate:up XXX
```
Onde XXX é o número da versão desejada.

### Reverter Migrations

Para reverter todas as migrations:
```bash
npm run migrate:down
```

Para reverter migrations até uma versão específica:
```bash
npm run migrate:down XXX
```
Onde XXX é o número da versão desejada.

## Funcionamento

- O sistema mantém um registro das migrations aplicadas na tabela indicada na variável `MIGRATIONS_TABLE` do arquivo .env do banco de dados.
- Ao aplicar migrations, o sistema executa apenas as migrations que ainda não foram aplicadas.
- Ao reverter, o sistema reverte apenas as migrations que foram aplicadas, na ordem inversa de aplicação.
- É possível especificar uma versão alvo tanto para aplicar quanto para reverter migrations.

## Boas Práticas

1. Sempre teste suas migrations em um ambiente de desenvolvimento antes de aplicá-las em produção.
2. Mantenha suas migrations versionadas junto com o código do projeto.
3. Escreva migrations idempotentes sempre que possível (podem ser executadas múltiplas vezes sem efeitos colaterais).
4. Faça backup do banco de dados antes de aplicar migrations em ambiente de produção.

## Resolução de Problemas

- Se uma migration falhar durante a aplicação ou reversão, o sistema realizará um rollback para manter a consistência do banco de dados.
- Verifique os logs de erro para identificar problemas específicos em caso de falha.

## Limitações

- Este sistema não suporta migrations concorrentes. Certifique-se de que apenas uma instância do script esteja rodando por vez.
- Não há suporte automático para migrations dependentes. Certifique-se de manter a ordem correta das migrations manualmente.
