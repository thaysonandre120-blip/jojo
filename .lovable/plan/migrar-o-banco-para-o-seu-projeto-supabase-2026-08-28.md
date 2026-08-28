# Migrar o banco para o seu projeto Supabase

Objetivo: gerar o SQL completo do banco atual (estrutura, segurança e usuário administrador) para você rodar no seu próprio projeto Supabase, e deixar o app pronto para apontar para lá.

## O que será entregue

1. **Um arquivo SQL único** (`/mnt/documents/schema-completo.sql`) contendo, na ordem correta:
   - o tipo `app_role` (admin / user)
   - as 10 tabelas: clients, suppliers, products, transactions, orcamentos, pedidos, contas, tasks, profiles, user_roles
   - as permissões de acesso da API para cada tabela (sem isso o app não enxerga nada)
   - a proteção por linha (RLS) e as 14 regras de acesso atuais — cada usuário só vê os próprios dados; administrador lê perfis e papéis
   - as funções `has_role` e `update_updated_at_column` mais os gatilhos de `updated_at`
2. **Um bloco separado** para criar o acesso administrador (`admin10@gmail.com`) no seu projeto, já que usuários de login não são copiados pelo SQL de estrutura.
3. **Instruções passo a passo** de onde colar o SQL no painel do seu projeto e como validar que funcionou.

## Apontar o app para o seu projeto

O app hoje lê as credenciais do backend gerenciado do Lovable. Para usar o seu projeto:

- Você desconecta o backend gerenciado e conecta o seu projeto Supabase pela tela de backend do Lovable (é uma ação sua no painel — não consigo trocar as credenciais por código, o arquivo de ambiente é gerenciado automaticamente).
- Depois disso eu revalido: login, leitura/escrita nas 8 tabelas de negócio, papel de administrador e bloqueio de acesso anônimo.

Importante: hoje as tabelas estão vazias (0 clientes, 0 produtos), então não há dados de negócio a migrar — apenas estrutura. Se preferir, também exporto os 2 perfis/papéis existentes como INSERTs.

## Detalhes técnicos

- Nenhuma alteração em frontend, rotas ou componentes.
- O SQL segue o padrão exigido: CREATE TABLE → GRANT (authenticated + service_role, sem anon) → ENABLE RLS → CREATE POLICY.
- `has_role` permanece SECURITY DEFINER com `search_path = public` e execução revogada para visitantes, evitando recursão nas policies.
- Chaves de id continuam `text` nas tabelas de negócio (como o app gera hoje) e `uuid` em profiles/user_roles.
