# Primeiro acesso do administrador

Hoje a tela de login só permite entrar — não existe nenhuma forma de criar a primeira conta, e o banco ainda não tem nenhum papel de administrador registrado (a tabela de papéis está vazia). Por isso o login `admin10@gmail.com` ainda não funciona.

## O que será feito

1. **Criar a conta administradora** `admin10@gmail.com` com a senha informada, já confirmada (sem precisar clicar em link de e-mail).
2. **Marcar essa conta como administrador**, criando também o perfil correspondente.
3. **Bloquear repetição**: a rotina de primeiro acesso só funciona enquanto não existir nenhum administrador. Depois disso ela se recusa a rodar, para ninguém criar um segundo admin por conta própria.
4. **Botão "Primeiro acesso" na tela de login**: aparece apenas quando ainda não há administrador no sistema; ao clicar, cria a conta e já entra no painel. Depois do primeiro uso ele desaparece automaticamente.
5. Recomendação: trocar a senha depois do primeiro login, em "Esqueci minha senha".

## Detalhes técnicos

- Nova server function `src/lib/bootstrap-admin.functions.ts`:
  - `adminExists()` — leitura pública contando linhas em `user_roles` com papel `admin` (via consulta segura no servidor).
  - `bootstrapAdmin()` — se já existir admin, retorna erro; caso contrário importa `supabaseAdmin` dentro do handler, cria o usuário com `auth.admin.createUser({ email, password, email_confirm: true })`, insere o perfil em `profiles` e a linha `admin` em `user_roles`. E-mail e senha ficam fixos no servidor (não vêm do cliente), evitando abuso.
- Migração: política/grant necessários apenas se a contagem de admins for feita via Data API; a contagem será feita no servidor com o cliente privilegiado, então nenhuma mudança de schema é necessária.
- `src/routes/auth.tsx`: consulta `adminExists()` na montagem; se não houver admin, mostra o botão "Primeiro acesso (criar conta do administrador)". Ao clicar: chama `bootstrapAdmin()`, depois `signInWithPassword` com as credenciais e navega para `/dashboard`.
