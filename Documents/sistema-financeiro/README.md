## Sistema Financeiro Multiempresa

Arquitetura inicial para o sistema financeiro colaborativo solicitado. O objetivo é possibilitar lançamentos mensais em tempo real, geração de relatórios consolidados e exibição de gráficos para diferentes níveis de usuários.

### Estrutura de diretórios

- `backend/`: código do servidor (Node.js + Express). Futuramente conterá módulos como:
  - `src/config`: variáveis ambiente, conexões (MySQL, JWT, storage).
  - `src/modules/*`: casos de uso (empresas, grupos, usuários, lançamentos, relatórios, gráficos).
  - `src/shared`: middlewares, helpers, tratadores de erro, providers (PDF, Chart).
  - `tests/`: testes unitários/integrados.
- `frontend/`: aplicação React (ou stack escolhida) com:
  - `src/pages`: dashboards para administradores, gestores e clientes.
  - `src/components`: inputs de lançamentos, tabelas, gráficos (Chart.js/ECharts).
  - `src/services`: consumo da REST API e WebSockets para atualizações em tempo real.
- `database/schema.sql`: definição do schema MySQL (empresas, grupos, usuários, lançamentos mensais e view de totalização).

### Visão da solução

- **Autenticação**: JWT, passwords com hash bcrypt/argon2, refresh tokens opcional.
- **Autorização**: middleware para perfis `ADMIN`, `MANAGER`, `CLIENT`, controlando CRUD e visualização.
- **Lançamentos Mensais**: endpoint CRUD com validação de período, cálculo automático de faturamento, impostos, compras, despesas e lucro/prejuízo prévio.
- **Relatórios e PDFs**: serviço dedicado que agrega dados por empresa ou grupo e gera PDF (Puppeteer/jsPDF) incluindo tabelas, percentuais e gráficos exportados.
- **Gráficos**: endpoints que retornam datasets normalizados para pizza, colunas e linha; frontend usa Chart.js/ECharts.
- **Tempo real**: planeja-se usar WebSockets ou SSE para refletir alterações durante reuniões.
- **Banco de Dados**: MySQL com relacionamentos, chaves únicas por empresa+período e view auxiliar `monthly_entry_totals` para facilitar consultas acumuladas.

Essa estrutura inicial permite evoluir incrementalmente, separando responsabilidades entre backend, frontend e banco, e mantendo o projeto organizado para futuras implementações.

