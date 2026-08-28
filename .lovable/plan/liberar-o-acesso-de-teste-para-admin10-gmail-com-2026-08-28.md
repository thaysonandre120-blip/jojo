# Liberar o acesso de teste para admin10@gmail.com

Objetivo: você conseguir entrar no sistema agora com `admin10@gmail.com` / `Admin11@com` e testar todas as funcionalidades. Nenhuma mudança na tela de login.

## O que será feito

1. Criar a conta `admin10@gmail.com` com a senha informada, já confirmada (sem link de e-mail).
2. Criar o perfil correspondente e dar a ela o papel de **administrador**.
3. Conferir que o login funciona e que o painel abre normalmente.

Nada de dados de exemplo é inserido — as áreas (clientes, produtos, orçamentos, pedidos, finanças) começam vazias, prontas para você popular depois.

Recomendação: trocar a senha depois dos testes, pelo link "Esqueci minha senha".

## Detalhes técnicos

- Criação do usuário via Auth Admin (`createUser` com `email_confirm: true`), executada uma única vez pela ferramenta de backend.
- Migração para inserir a linha em `public.profiles` (id = uid, nome e e-mail) e a linha `admin` em `public.user_roles`, ambas idempotentes (`on conflict do nothing`).
- Sem alterações em `src/routes/auth.tsx` nem em políticas RLS existentes.
