# API de Pagamentos — PIX e Cartão de Crédito

API REST para gerenciar o ciclo de vida de cobranças de um sistema financeiro,
com integração ao **Mercado Pago** para transações via cartão de crédito.

Construída com **NestJS 12**, **PostgreSQL 17** e **Clean Architecture**, sobre
**Node 24**. Opcionalmente, o fluxo de cartão roda como um **workflow durável
do Temporal.io** — ver [Temporal.io](#-temporalio--fluxo-de-cartão-durável-opcional).

---

## 📑 Índice

- [Visão geral](#-visão-geral)
- [Stack](#-stack)
- [Pré-requisitos](#-pré-requisitos)
- [Subindo o projeto](#-subindo-o-projeto)
- [Endpoints](#-endpoints)
- [Exemplos de uso](#-exemplos-de-uso)
- [Domínio e regras de negócio](#-domínio-e-regras-de-negócio)
- [Integração com o Mercado Pago](#-integração-com-o-mercado-pago)
- [Teste ponta a ponta](#-teste-ponta-a-ponta-com-o-mercado-pago)
- [Temporal.io (opcional)](#-temporalio--fluxo-de-cartão-durável-opcional)
  - [Tutorial — teste completo com o Temporal](#-tutorial--teste-completo-com-o-temporal)
- [Arquitetura](#-arquitetura)
- [Configuração](#-configuração)
- [Validações](#-validações)
- [Tratamento de erros](#-tratamento-de-erros)
- [Testes](#-testes)
- [Qualidade de código](#-qualidade-de-código)
- [Docker](#-docker)
- [Decisões técnicas](#-decisões-técnicas)
- [Próximos passos](#-próximos-passos)
- [Scripts](#-scripts)

---

## 🎯 Visão geral

A API gerencia cobranças que nascem **pendentes** e terminam **pagas** ou
**falhas**. O caminho depende do meio de pagamento:

```
POST /api/payment
       │
       ├── paymentMethod: PIX ──────────► grava PENDING no banco. Fim.
       │                                  (sem integração externa)
       │
       └── paymentMethod: CREDIT_CARD ──► grava PENDING
                                              │
                                              ▼
                                   Mercado Pago: cria preferência
                                   POST /checkout/preferences
                                              │
                                              ▼
                                   guarda externalId + checkoutUrl e
                                   devolve a URL para o cliente pagar
                                              │
                                    ( cliente paga no checkout )
                                              │
                                              ▼
                                   Mercado Pago chama de volta
                                   POST /api/payment/webhook
                                              │
                                              ▼
                                   consulta o status na origem e
                                   atualiza para PAID ou FAIL
```

---

## 🛠 Stack

| Camada               | Tecnologia            | Versão                                            |
| -------------------- | --------------------- | ------------------------------------------------- |
| Runtime              | Node.js               | 24 (fixado em `.nvmrc`)                           |
| Gerenciador          | pnpm                  | 12.4.2 (via Corepack, fixado em `packageManager`) |
| Framework            | NestJS                | 12                                                |
| Servidor HTTP        | Fastify               | 5                                                 |
| Linguagem            | TypeScript            | 5.9.3                                             |
| Banco                | PostgreSQL            | 17                                                |
| ORM                  | TypeORM               | 1.1.1                                             |
| Validação de entrada | class-validator       | 0.15                                              |
| Validação de config  | Zod                   | 4.6                                               |
| Documentação         | Swagger / OpenAPI     | 12                                                |
| Orquestração         | Temporal.io           | 1.24 (SDK), 1.32 (servidor) — opcional            |
| Testes               | Jest                  | 30                                                |
| Lint / Format        | ESLint 9 + Prettier 3 | —                                                 |
| Git hooks            | Lefthook              | 2.1                                               |
| Padrão de commits    | commitlint            | 21                                                |

---

## 📋 Pré-requisitos

- **Git** — para clonar
- **Docker** — nos dois modos (só o banco, ou a stack inteira)
- **Node.js 24** — só no modo dev; versão fixada em `.nvmrc` e `.node-version`
- **pnpm** — só no modo dev; via Corepack, sem instalação global

No **modo Docker** nada além do próprio Docker precisa estar instalado. Para o
**modo dev**:

```bash
nvm use            # usa o Node 24 do .nvmrc
corepack enable    # disponibiliza o pnpm fixado no package.json
pnpm install       # instala as dependências e os git hooks
```

> O `pnpm install` roda `lefthook install` automaticamente (script `prepare`),
> deixando os hooks de git ativos.

---

## 🏃 Subindo o projeto

Os dois modos sobem a API em `:3000` e são equivalentes do ponto de vista do
cliente. A diferença está em **onde o Node roda** e, por consequência, em qual
arquivo de ambiente é lido.

|                          | Modo dev             | Modo Docker                        |
| ------------------------ | -------------------- | ---------------------------------- |
| Node roda                | na sua máquina       | em container                       |
| Ambiente                 | `.env`               | `.env.docker` (via `env_file`)     |
| Host do banco            | `localhost`          | `postgres` (nome do serviço)       |
| Hot-reload               | `nest start --watch` | `ts-node-dev` sobre volume montado |
| Precisa de Node 24 local | sim                  | não                                |

### Passo comum — clonar

```bash
git clone <url-do-repositorio>
cd node-nestjs-pix-credit-card
```

Todos os comandos deste README são executados **a partir da raiz do
repositório** — a pasta que contém o `package.json`.

> 💡 **Copiando arquivos no Windows.** Os blocos usam `cp`, do Unix. Ele
> funciona no **PowerShell** (é alias de `Copy-Item`) e no **Git Bash**. No
> **cmd.exe** não existe: troque por `copy`.
>
> | Shell                                   | Comando                  |
> | --------------------------------------- | ------------------------ |
> | PowerShell, Git Bash, WSL, macOS, Linux | `cp .env.example .env`   |
> | cmd.exe                                 | `copy .env.example .env` |

### Modo dev — banco em Docker, API local

Recomendado para desenvolver: o ciclo de reload é mais rápido e o debugger
conecta direto.

```bash
cp .env.example .env    # (cmd.exe: copy .env.example .env)
docker compose up -d    # PostgreSQL, Adminer e Temporal — a API não
pnpm install            # dependências + git hooks
pnpm start:dev          # API em :3000, com hot-reload
```

O `docker compose up -d` sobe **toda a infraestrutura, menos a API**: ela roda
na sua máquina, na porta 3000, e um container da API disputaria essa porta.
Por isso o serviço `app` fica no profile `docker` e só sobe quando pedido — no
[modo Docker](#modo-docker--tudo-em-containers).

O exemplo vem com o [Temporal](#-temporalio--fluxo-de-cartão-durável-opcional)
**ligado** (`TEMPORAL_ENABLED=true`). Pronto quando o log mostrar as três
linhas:

```text
[TemporalClientService] Conectado ao Temporal em localhost:7233 (namespace default).
[TemporalWorkerService] Worker do Temporal ouvindo a fila "payments".
[Bootstrap] Aplicação rodando em http://localhost:3000
```

Confirme:

```bash
curl http://localhost:3000/api/v1/health-check
```

> **Sem Temporal:** troque para `TEMPORAL_ENABLED=false` no `.env`. O fluxo de
> cartão volta a rodar dentro da request, como antes da integração — o
> container do Temporal pode ficar de pé, só não é usado.

### Modo Docker — tudo em containers

Não exige Node nem pnpm na máquina, só Docker.

```bash
cp .env.docker.example .env.docker     # (cmd.exe: copy .env.docker.example .env.docker)
docker compose --profile docker up --build   # PostgreSQL + Adminer + Temporal + API
```

O `--profile docker` é o que inclui a API: sem ele, o compose sobe só a
infraestrutura do modo dev.

Com `pnpm` disponível, o atalho equivalente é `pnpm start:api:docker:dev`.

A primeira subida leva alguns minutos (build da imagem e instalação das
dependências). Confirme do mesmo jeito:

```bash
curl http://localhost:3000/api/v1/health-check
```

Sobe PostgreSQL, Adminer, Temporal e a API juntos, com hot-reload via volume:
o código da sua máquina é montado no container, então editar um `.ts`
recarrega a API sem rebuild.

> O `.env.docker` é **gitignored** e declarado como `required: false` no
> compose — a stack sobe sem ele. A precedência dentro do container, do mais
> forte para o mais fraco:
>
> ```
> environment: do compose  >  .env.docker  >  .env  >  config/*.yml
> ```
>
> O `.env` entra nessa lista porque a pasta do projeto é montada no
> container: o arquivo do modo dev fica visível lá dentro e serve de
> fallback. Por isso, se você já configurou o modo dev, o modo Docker pode
> funcionar mesmo sem `.env.docker`.

Para acompanhar os logs e derrubar:

```bash
docker compose logs -f app
docker compose --profile docker down   # acrescente -v para apagar também o banco
```

Sem o `--profile docker`, o `down` derruba a infraestrutura e **deixa o
container da API para trás**.

> ⚠️ **Já subiu o modo Docker antes?** O `node_modules` do container vive num
> volume (`api_node_modules`) que **não é refeito no rebuild**. Depois de
> mudança de dependências — como a entrada do Temporal, ou a troca da imagem
> de Alpine para Debian — apague o volume uma vez:
>
> ```bash
> docker compose --profile docker down
> docker volume rm node-nestjs-pix-credit-card_api_node_modules
> docker compose --profile docker up --build
> ```
>
> Sintoma de volume velho: `Cannot find module '@temporalio/...'`, ou erro ao
> carregar o `core-bridge` do Temporal. O volume do banco não é afetado.

### ⚠️ O que você tem depois de copiar o exemplo — e o que ainda não tem

Os arquivos de exemplo **não trazem credenciais**. A API sobe e os endpoints
respondem, mas **nada disso fala com o Mercado Pago**: o fluxo de cartão é
atendido pelo gateway simulado.

> Isto é um **smoke test** — serve para confirmar que o ambiente está de pé.
> A integração de verdade, que é o que o desafio exige, está no
> [Teste ponta a ponta](#-teste-ponta-a-ponta-com-o-mercado-pago): criar
> conta, aplicação, credenciais, e pagar num checkout real.

| Variável no exemplo             | Estado    | Efeito                                                  |
| ------------------------------- | --------- | ------------------------------------------------------- |
| `MERCADO_PAGO_ACCESS_TOKEN`     | vazia     | Resolve o **gateway simulado** no lugar do Mercado Pago |
| `MERCADO_PAGO_NOTIFICATION_URL` | comentada | Preferência sai sem `notification_url`                  |
| `MERCADO_PAGO_BACK_URL`         | comentada | Preferência sai sem `back_urls`                         |
| `MERCADO_PAGO_WEBHOOK_SECRET`   | vazia     | Webhook aceita POST sem assinatura                      |
| `TEMPORAL_ENABLED`              | `true`    | Fluxo de cartão via workflow; exige o servidor de pé    |

Nada disso derruba a aplicação: no schema de config os quatro campos do
Mercado Pago são opcionais, e as regras que os tornam obrigatórios valem **só
em produção**. O Temporal é a exceção: ligado e sem servidor, a API não sobe
— e diz qual comando falta.

E as duas URLs comentadas são **inertes** nessa configuração — sem token, quem
atende é o `FakePaymentGateway`, que não recebe config nenhuma. Elas só passam
a importar depois que você preenche o token.

Como saber em qual dos dois você está — o prefixo do `externalId` denuncia:

```bash
curl -X POST http://localhost:3000/api/payment -H "Content-Type: application/json" \
  -d '{"cpf":"52998224725","description":"Teste","amount":10,"paymentMethod":"CREDIT_CARD"}'
```

| `externalId` na resposta  | Significa                                               |
| ------------------------- | ------------------------------------------------------- |
| `fake-pref-be443731-...`  | Gateway **simulado**. Nenhuma chamada externa aconteceu |
| `3705479006-365ea32d-...` | Preferência **real**, criada no Mercado Pago            |

**Próximo passo:** [Teste ponta a ponta](#-teste-ponta-a-ponta-com-o-mercado-pago).

### Serviços disponíveis

| Serviço                         | Endereço                                    | Sobe com                                         |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------ |
| **API REST**                    | `http://localhost:3000/api`                 | `pnpm start:dev` · Docker: `--profile docker up` |
| **Swagger**                     | `http://localhost:3000/api-docs-v1`         | idem                                             |
| **Health check**                | `http://localhost:3000/api/v1/health-check` | idem                                             |
| **PostgreSQL**                  | `localhost:5432`                            | `docker compose up -d`                           |
| **Adminer** (cliente do banco)  | `http://localhost:8080`                     | `docker compose up -d`                           |
| **Temporal UI** (workflows)     | `http://localhost:8233`                     | `docker compose up -d`                           |
| **Temporal** (gRPC, API/worker) | `localhost:7233`                            | `docker compose up -d`                           |

No Adminer: sistema **PostgreSQL**, servidor `postgres` (já vem preenchido),
usuário `postgres`, senha `postgres`, base `payments`. Com o banco recém-criado
a base aparece vazia: a tabela `payments` só nasce quando a API sobe pela
primeira vez. A UI do Temporal não pede login — é o
equivalente do Adminer para os workflows (ver
[Tutorial](#-tutorial--teste-completo-com-o-temporal)).

> A tabela `payments` é criada pelas **migrations**, aplicadas
> automaticamente na subida (`migrationsRun: true`) em todos os ambientes.
> Se o seu banco local foi criado por uma versão antiga do projeto (quando o
> schema vinha do `synchronize`), recrie o volume antes de subir:
> `docker compose down -v && docker compose up -d`.

---

## 🔗 Endpoints

| Método | Rota                           | Descrição                                 |
| ------ | ------------------------------ | ----------------------------------------- |
| `POST` | `/api/payment`                 | Cria um pagamento                         |
| `GET`  | `/api/payment`                 | Lista com filtros e paginação             |
| `GET`  | `/api/payment/:id`             | Busca por id                              |
| `PUT`  | `/api/payment/:id`             | Atualiza descrição e/ou status (parcial)  |
| `POST` | `/api/payment/webhook`         | Recebe a notificação do Mercado Pago      |
| `GET`  | `/api/payment/checkout/return` | Recebe o cliente de volta do Checkout Pro |
| `GET`  | `/api/v1/health-check`         | Health check                              |

> Com o [Temporal](#-temporalio--fluxo-de-cartão-durável-opcional) ligado, o
> `POST` de cartão pode responder **`202 Accepted`** em vez de `201`: a
> cobrança foi aceita, mas a preferência ainda está sendo criada em segundo
> plano. O `checkoutUrl` aparece no `GET /api/payment/:id` assim que ficar
> pronto.

### Sobre o versionamento

As rotas respondem **tanto em `/api/payment` quanto em `/api/v1/payment`**. O
controller é declarado como `VERSION_NEUTRAL` **mais** `v1`:

```ts
@Controller({ path: 'payment', version: [VERSION_NEUTRAL, '1'] })
```

Assim o contrato pedido no escopo (`/api/payment`) vale, e o versionamento fica
disponível para evoluir a API sem quebrar clientes.

---

## 💡 Exemplos de uso

### Criar um pagamento PIX

```bash
curl -X POST http://localhost:3000/api/payment \
  -H "Content-Type: application/json" \
  -d '{
    "cpf": "529.982.247-25",
    "description": "Mensalidade de outubro",
    "amount": 149.90,
    "paymentMethod": "PIX"
  }'
```

```json
{
  "id": "571a2c7f-49bd-4648-a045-c80a40924012",
  "cpf": "52998224725",
  "description": "Mensalidade de outubro",
  "amount": 149.9,
  "paymentMethod": "PIX",
  "status": "PENDING",
  "externalId": null,
  "checkoutUrl": null,
  "createdAt": "2026-09-19T23:26:48.743Z",
  "updatedAt": "2026-09-19T23:26:48.777Z"
}
```

> O CPF é aceito com ou sem máscara e **persistido sem máscara**.

### Criar um pagamento com cartão

```bash
curl -X POST http://localhost:3000/api/payment \
  -H "Content-Type: application/json" \
  -d '{
    "cpf": "52998224725",
    "description": "Compra parcelada",
    "amount": 250.00,
    "paymentMethod": "CREDIT_CARD"
  }'
```

A resposta traz o `externalId` (id da preferência no Mercado Pago) e o
`checkoutUrl` — **é para essa URL que o cliente deve ser enviado para pagar**:

```json
{
  "id": "b88a7b3d-6f90-4fcb-af96-d13ca98eb905",
  "status": "PENDING",
  "externalId": "3705479006-365ea32d-fe63-47ef-bf0a-7d33821cfbc1",
  "checkoutUrl": "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=3705479006-365ea32d-fe63-47ef-bf0a-7d33821cfbc1",
  "...": "..."
}
```

Para PIX os dois campos vêm `null`: não há integração externa.

### Consultar por id

```bash
curl http://localhost:3000/api/payment/571a2c7f-49bd-4648-a045-c80a40924012
```

### Listar com filtros

```bash
# Por CPF (aceita com ou sem máscara)
curl "http://localhost:3000/api/payment?cpf=529.982.247-25"

# Por meio de pagamento
curl "http://localhost:3000/api/payment?paymentMethod=CREDIT_CARD"

# Por status
curl "http://localhost:3000/api/payment?status=PAID"

# Combinados
curl "http://localhost:3000/api/payment?cpf=52998224725&paymentMethod=PIX&status=PENDING"

# Paginação (padrão: page=1, limit=20; limit máximo 100)
curl -i "http://localhost:3000/api/payment?page=2&limit=10"
```

A resposta continua sendo um **array**, do mais recente para o mais antigo. O
total de registros que atendem aos filtros vem no cabeçalho `X-Total-Count`
(exposto via CORS), para o cliente calcular as páginas sem mudar o formato do
corpo.

### Atualizar o status

```bash
curl -X PUT http://localhost:3000/api/payment/571a2c7f-49bd-4648-a045-c80a40924012 \
  -H "Content-Type: application/json" \
  -d '{ "status": "PAID" }'
```

O verbo é `PUT` porque o enunciado pede `PUT /api/payment/{id}`, mas a
semântica é de **atualização parcial**: só `description` e `status` são
aceitos, e só os campos enviados mudam (qualquer outro campo é recusado com
`400`). Em uma API sem esse contrato fixado, o verbo seria `PATCH`.

A mudança manual de status vale **só para PIX**. Em `CREDIT_CARD` quem decide
`PAID`/`FAIL` é a confirmação do Mercado Pago (webhook ou reconciliação); um
`PUT` com `status` diferente do atual responde **409**. A descrição continua
editável nos dois meios.

---

## 📦 Domínio e regras de negócio

### Modelo

| Propriedade               | Tipo                | Descrição                               |
| ------------------------- | ------------------- | --------------------------------------- |
| `id`                      | `uuid`              | Identificador único (UUID v4)           |
| `cpf`                     | `char(11)`          | CPF do cliente, sem máscara             |
| `description`             | `varchar(255)`      | Descrição da cobrança                   |
| `amount`                  | `numeric(12,2)`     | Valor da transação                      |
| `paymentMethod`           | `enum`              | `PIX` \| `CREDIT_CARD`                  |
| `status`                  | `enum`              | `PENDING` \| `PAID` \| `FAIL`           |
| `externalId`              | `varchar` \| `null` | Id da preferência no Mercado Pago       |
| `checkoutUrl`             | `varchar` \| `null` | URL do Checkout Pro onde o cliente paga |
| `version`                 | `integer`           | Controle otimista de concorrência       |
| `createdAt` / `updatedAt` | `timestamptz`       | Auditoria                               |

### Máquina de estados

Um pagamento **nasce `PENDING`**. `PAID` e `FAIL` são **estados finais** — não
retrocedem nem se convertem um no outro.

```
            ┌──────────► PAID  (final)
PENDING ────┤
            └──────────► FAIL  (final)
```

A regra vive na **própria entidade**, não no controller nem no caso de uso:

```ts
// src/domain/entities/payment.entity.ts
const ALLOWED_TRANSITIONS: Readonly<Record<PaymentStatus, PaymentStatus[]>> = {
  [PaymentStatus.PENDING]: [PaymentStatus.PAID, PaymentStatus.FAIL],
  [PaymentStatus.PAID]: [],
  [PaymentStatus.FAIL]: [],
};

public transitionTo(status: PaymentStatus): Payment {
  if (status === this.status) return this;              // idempotente
  if (!this.canTransitionTo(status)) {
    throw new InvalidPaymentStatusTransitionException(this.status, status);
  }
  return this.copy({ status });                         // nova instância
}
```

Tentar `PAID → FAIL` devolve **409 Conflict**.

### A entidade é imutável

Todo método que "altera" um pagamento devolve **uma nova instância**
(`transitionTo`, `withDescription`, `withCheckout`), e o construtor revalida
as invariantes. Não existe caminho que produza um `Payment` inválido.

### Concorrência

Webhook, reconciliação e `PUT` podem tocar o mesmo pagamento ao mesmo tempo.
Cada `Payment` carrega a `version` com que foi lido, e o repositório só grava
se a linha ainda estiver nessa versão:

```sql
UPDATE payments SET ..., version = version + 1 WHERE id = $1 AND version = $2
```

Se outra operação gravou antes, nada é sobrescrito: sai
`ConcurrentPaymentUpdateException` (**409**). No webhook, o 409 faz o Mercado
Pago reenviar a notificação; no Temporal, a activity é retentada — nos dois
casos a próxima tentativa relê o estado atual.

### Regras por meio de pagamento

| Meio            | Comportamento                                                                               |
| --------------- | ------------------------------------------------------------------------------------------- |
| **PIX**         | Apenas grava o registro como `PENDING`. Sem integração externa.                             |
| **CREDIT_CARD** | Cria a preferência de checkout no Mercado Pago, guarda o `externalId` e aguarda o callback. |

Cada meio é uma **estratégia** (`PaymentMethodStrategy`) registrada no módulo;
o `CreatePaymentUseCase` só escolhe a estratégia pelo `paymentMethod`. Um meio
novo (boleto, por exemplo) é uma classe nova e uma linha no wiring — o caso de
uso não muda.

---

## 💳 Integração com o Mercado Pago

### Fluxo completo

1. **Criação da preferência** — `POST https://api.mercadopago.com/checkout/preferences`
   - O `external_reference` leva **o id do nosso pagamento** — é por ele que o
     webhook reencontra o registro.
   - O mesmo id vai como **`X-Idempotency-Key`**: um retry não cria preferência
     duplicada.
2. **Redirecionamento** — o `init_point` devolvido é persistido como
   `checkoutUrl` e sai na resposta da API. É para lá que o cliente vai pagar.
3. **Callback** — o Mercado Pago chama a `notification_url` configurada
   (`POST /api/payment/webhook`), assinando a requisição com `x-signature`.
4. **Consulta na origem** — o webhook chama
   `GET /v1/payments/{id}` e traduz o status.
5. **Retorno do cliente** — as `back_urls` trazem o navegador de volta para
   `GET /api/payment/checkout/return`. É só navegação: quem decide o status é
   o webhook, porque essa rota depende do cliente e pode nunca ser chamada.

### O corpo do webhook não é fonte de verdade

Do payload recebido, **só o id é aproveitado**. O status vem sempre de uma
consulta à API do Mercado Pago:

```ts
// src/application/usecases/payment/process-payment-notification.usecase.ts
const gatewayPayment =
  await this.paymentGateway.fetchPayment(providerPaymentId);

return this.applyGatewayPayment.execute(gatewayPayment);
```

Quem aplica o status é o `ApplyGatewayPaymentUseCase`, que reencontra o
pagamento pelo `external_reference` — o mesmo caso de uso usado pela
reconciliação e pelo Temporal.

### Tradução de status

| Mercado Pago                             | Nosso domínio   |
| ---------------------------------------- | --------------- |
| `approved`                               | `PAID`          |
| `rejected`, `cancelled`                  | `FAIL`          |
| `pending`, `in_process`, `authorized`, … | segue `PENDING` |

### O webhook é autenticado

Um endpoint de webhook é público por natureza: sem verificação, qualquer um
que descubra a URL marca uma cobrança como `PAID` com um `curl`.

O Mercado Pago assina cada notificação:

```http
x-signature: ts=1704908010,v1=618c85345248dd820d5fd456117c2ab2ef8eda45a0282ff693eac24131a5e839
x-request-id: bb56a2f1-6aae-46ac-982e-9dcd3581d08e
```

O `v1` é um HMAC-SHA256, com o segredo do painel como chave, sobre um
manifesto montado a partir do `data.id` (em minúsculas), do `x-request-id` e
do próprio `ts`:

```
id:1234567890;request-id:bb56a2f1-6aae-46ac-982e-9dcd3581d08e;ts:1704908010;
```

Partes ausentes saem do manifesto **junto com a sua chave**. O `ts` entrar no
cálculo é o que impede reaproveitar uma assinatura antiga.

A verificação vive num `Guard`, aplicado só nessa rota
([`MercadoPagoSignatureGuard`](src/presentation/guards/mercado-pago-signature.guard.ts)),
e a comparação é feita em **tempo constante** — um `===` vazaria, pelo tempo
de resposta, quantos caracteres do HMAC o atacante já acertou.

Com `MERCADO_PAGO_WEBHOOK_SECRET` vazio a verificação é desligada, para
permitir disparar o webhook à mão em desenvolvimento. **Em produção o segredo
é obrigatório** — o schema de config recusa subir sem ele.

### Idempotência do webhook

O Mercado Pago **reenvia a notificação até receber 2xx**, então o mesmo evento
chega várias vezes. O `ApplyGatewayPaymentUseCase` trata isso em três camadas:

- status igual ao atual → não grava nada
- transação ainda em andamento (`status: null`) → não grava nada
- pagamento já em estado final diferente → registra um `warn` e **responde 200**,
  para não provocar retentativas infinitas

O endpoint devolve `{ "received": true }` com **HTTP 200**, inclusive para
eventos que ignoramos (o Mercado Pago também envia `merchant_order`). Só não
responde 200 quando não conseguiu processar: falha ao consultar o Mercado Pago
(`502`) ou escrita concorrente no mesmo pagamento (`409`). Nos dois casos o
Mercado Pago reenvia a notificação, e a próxima tentativa é processada.

### 🧪 O gateway simulado — e o que ele NÃO é

O projeto tem um `FakePaymentGateway`. Ele existe por **duas** razões, e
nenhuma delas é substituir a integração:

1. **Testes automatizados** — os testes (unitários e e2e) não podem depender
   de rede, de credenciais nem da disponibilidade do provedor.
2. **Rede de segurança** — quem clona o repositório sem conta no Mercado Pago
   ainda consegue subir a API e ver os endpoints respondendo.

> ⚠️ **Ele não é o caminho do tutorial.** O desafio exige integração real com
> o Mercado Pago, e é isso que o
> [Teste ponta a ponta](#-teste-ponta-a-ponta-com-o-mercado-pago) percorre —
> da criação da conta até o callback chegando. O simulado nunca fala com o
> provedor: não cria preferência, não recebe webhook, não prova nada sobre a
> integração.
>
> Como reconhecer que você caiu nele: o `externalId` começa com `fake-pref-`.

Se `MERCADO_PAGO_ACCESS_TOKEN` estiver vazio, o container resolve o
`FakePaymentGateway` no lugar do `MercadoPagoGateway`:

```ts
// src/modules/payment.module.ts
{
  provide: PaymentGatewayPort,
  inject: [mercadoPagoConfig.KEY, MercadoPagoGateway, FakePaymentGateway],
  useFactory: (config, mercadoPago, fake) =>
    config.accessToken ? mercadoPago : fake,
}
```

O log informa o `providerPaymentId` simulado para você disparar o webhook à mão:

```bash
curl -X POST http://localhost:3000/api/payment/webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"payment","data":{"id":"fake-pay-..."}}'
```

Basta preencher o token para a integração passar a ser real — **nada mais muda**,
porque quem depende da porta (`PaymentGatewayPort`) não sabe qual adapter está
por trás.

### 🔑 Passando a falar com o Mercado Pago de verdade

Basta preencher `MERCADO_PAGO_ACCESS_TOKEN`. O passo a passo completo, com os
dois modos de execução, está em
[Teste ponta a ponta](#-teste-ponta-a-ponta-com-o-mercado-pago).

---

## 🎬 Teste ponta a ponta com o Mercado Pago

**Integração real, do zero.** Este roteiro não usa o gateway simulado: ele
cria a conta, a aplicação e as credenciais, fala com a API do Mercado Pago de
verdade e termina com um pagamento saindo de `PENDING` para `PAID` **sozinho**,
pelo callback do provedor.

São 11 passos (o último é opcional) e leva cerca de 20 minutos na primeira
vez. Funciona nos **dois modos de execução** — as diferenças estão marcadas.

```
 1. conta ──► 2. aplicação ──► 3. credenciais  ─┐
                                 (token no .env) │
                                                 ▼
                                4. conta de teste compradora
                                                 │
                                                 ▼
 5. túnel ──► 6. URLs no .env ──► 7. subir ──► 8. cobrança ──► 9. pagar
                                                                   │
                                                                   ▼
                                   11. assinatura ◄── 10. conferir
                                       (opcional)
```

O `.env` é preenchido em **duas etapas** de propósito: o token existe desde o
passo 3, mas as URLs só depois que o túnel gera o endereço, no passo 5.

> ⚠️ **Nunca pague com a sua conta nem com o seu cartão real.** A página do
> Checkout Pro é a mesma de produção: se o navegador estiver logado na sua
> conta pessoal, ela lista os seus cartões salvos. A
> [doc de compras de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/integration-test/test-purchases)
> manda usar **janela anônima** com uma **conta de teste compradora** — e não
> promete que um cartão real seria bloqueado. Não vale o risco.

### Passo 1 — Criar a conta no Mercado Pago

Se você ainda não tem, crie uma conta comum em
<https://www.mercadopago.com.br> e acesse o painel de desenvolvedores em
<https://www.mercadopago.com.br/developers>.

Essa é a sua conta **real**. Ela nunca recebe pagamento de teste — serve
apenas para abrigar a aplicação e gerar as credenciais.

### Passo 2 — Criar a aplicação

No painel de desenvolvedores:

1. Clicar em **Integrações**
2. Clicar em **Criar aplicação**
3. Dar um nome à aplicação (livre — ex.: `API Pagamentos PIX e Cartão`)
4. Escolher **Criar no painel de integração**
5. Escolher **Checkout PRO**
6. Em **Tipo de API**, escolher **API de Preferences**
7. Marcar **Autorizo o uso...** e clicar em **Criar aplicação**

> ⚠️ **Os passos 5 e 6 decidem se o projeto funciona.**
>
> **Checkout PRO** é o produto em que o Mercado Pago hospeda a página de
> pagamento — é o que permite devolver um `checkoutUrl` e nunca tocar em dados
> de cartão.
>
> **API de Preferences** é literalmente a "API de Preferências do Checkout"
> que o desafio exige: é ela que expõe o `POST /checkout/preferences` usado
> pelo [`MercadoPagoGateway`](src/infrastructure/gateways/mercado-pago.gateway.ts).
> Escolhendo outro tipo de API (Orders, por exemplo), as credenciais saem
> válidas mas apontando para outra integração, e a criação da cobrança falha.

📅 O painel do Mercado Pago muda com alguma frequência. Estes passos refletem a
interface em **setembro de 2026**; se os rótulos divergirem, procure pelo
produto **Checkout Pro** e pela API de **Preferences**.

### Passo 3 — Copiar as credenciais de teste

Na página da aplicação → **Credenciais de teste**.

Copie o **Access Token** (começa com `APP_USR-`). É a única credencial que
este projeto usa — a Public Key só é necessária para SDK de frontend, que aqui
não existe.

> **Teste × Produção.** As credenciais de teste movimentam dinheiro fictício e
> só aceitam pagamento vindo de contas de teste. As de produção cobram de
> verdade. Este roteiro usa **exclusivamente as de teste**.

Confirme que o token funciona antes de seguir:

```bash
curl -s -H "Authorization: Bearer <SEU_ACCESS_TOKEN>" \
  https://api.mercadopago.com/users/me
```

Deve responder `200` com um `nickname` começando em `TESTUSER` — as
credenciais de teste pertencem a uma conta vendedora de teste criada
automaticamente para a sua aplicação.

**Guarde o token agora**, no arquivo de ambiente do modo que você vai usar.
Não deixe só na área de transferência: o passo 4 devolve uma senha que você
também vai precisar copiar.

```bash
# Modo dev
cp .env.example .env                  # (cmd.exe: copy .env.example .env)

# Modo Docker
cp .env.docker.example .env.docker    # (cmd.exe: copy ...)
```

E preencha a linha que já está lá, no arquivo que você copiou:

```env
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...
```

As outras variáveis ficam para o [passo 6](#passo-6--completar-o-ambiente) —
elas dependem da URL que o túnel só vai gerar no passo 5.

> Já dá para conferir que o token foi lido: suba a API
> ([passo 7](#passo-7--subir)) e crie uma cobrança de cartão. Se o
> `externalId` vier como `fake-pref-...`, o token não chegou na aplicação.

### Passo 4 — Criar a conta de teste compradora

Quem vende é a conta do passo 3. Como o Mercado Pago **recusa pagamento de
alguém para si mesmo**, é preciso uma segunda conta, do tipo comprador.

**Pelo painel:** página da aplicação → **Contas de teste** →
**+ Criar conta de teste** → país **Brasil**, tipo **Comprador**, e um saldo
fictício qualquer.

**Ou pela API**, que é mais rápido:

```bash
curl -X POST https://api.mercadopago.com/users/test_user \
  -H "Authorization: Bearer <SEU_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"site_id":"MLB"}'
```

```json
{
  "id": 3699839136,
  "email": "test_user_8336898289274213829@testuser.com",
  "nickname": "TESTUSER8336898289274213829",
  "password": "joZoNS5ZyU"
}
```

Guarde e-mail e senha: **a senha só aparece uma vez**. São permitidas até 15
contas de teste e elas **não podem ser apagadas** — não saia criando à toa.

### Passo 5 — Expor a API numa URL pública

O Mercado Pago precisa alcançar o seu webhook de fora, e `localhost` não
serve. Num terminal separado, que fica aberto:

```bash
pnpm tunnel
```

Sobe um **Cloudflare Tunnel** em container — sem conta, sem instalação, sem
cadastro. Ele imprime:

```
+--------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at:            |
|  https://randy-roberts-ppm-lecture.trycloudflare.com         |
+--------------------------------------------------------------+
```

O mesmo túnel serve aos dois modos: ele aponta para a porta `3000` da sua
máquina, que é a mesma publicada pelo container.

> ⚠️ Enquanto o túnel estiver de pé, **a sua API local está acessível na
> internet**. Encerre com `Ctrl+C` ao terminar. A URL muda a cada execução — e
> com ela o arquivo de ambiente e o cadastro no painel.

### Passo 6 — Completar o ambiente

O token você já colocou no [passo 3](#passo-3--copiar-as-credenciais-de-teste).
Falta acrescentar as duas URLs, que só existem agora — substitua `<id>` pelo
subdomínio que o túnel imprimiu.

Abra o arquivo do seu modo — `.env` (dev) ou `.env.docker` (Docker) —,
descomente as duas linhas e preencha:

```env
MERCADO_PAGO_NOTIFICATION_URL=https://<id>.trycloudflare.com/api/payment/webhook
MERCADO_PAGO_BACK_URL=https://<id>.trycloudflare.com
```

O arquivo fica assim (as demais variáveis já vieram do exemplo):

```env
NODE_ENV=development
POSTGRES_PASSWORD=postgres

MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...
MERCADO_PAGO_NOTIFICATION_URL=https://<id>.trycloudflare.com/api/payment/webhook
MERCADO_PAGO_BACK_URL=https://<id>.trycloudflare.com
```

Os dois modos usam o mesmo conteúdo. `POSTGRES_HOST` **não** entra no
`.env.docker`: quem define é o `docker-compose.yml`, porque dentro da rede do
compose o banco atende pelo nome do serviço.

> Deixe `MERCADO_PAGO_WEBHOOK_SECRET` **comentado** por enquanto. Preenchido
> com um valor que não seja o do painel, a API rejeita com `401` as
> notificações legítimas. Ligar a verificação é o passo 11.

### Passo 7 — Subir

**Modo dev:**

```bash
pnpm install                     # só na primeira vez
docker compose up -d             # PostgreSQL, Adminer e Temporal
pnpm start:dev
```

**Modo Docker:**

```bash
docker compose --profile docker up --build    # ou: pnpm start:api:docker:dev
```

Confirme que está de pé — pela máquina e pelo túnel:

```bash
curl http://localhost:3000/api/v1/health-check
curl https://<id>.trycloudflare.com/api/v1/health-check
```

O segundo é o que importa: se ele falhar, o callback nunca vai chegar.

### Passo 8 — Criar a cobrança

```bash
curl -X POST http://localhost:3000/api/payment \
  -H "Content-Type: application/json" \
  -d '{
    "cpf": "52998224725",
    "description": "Teste ponta a ponta",
    "amount": 75.50,
    "paymentMethod": "CREDIT_CARD"
  }'
```

```json
{
  "id": "552d64a5-bf9d-4e38-ad66-f5f45e2ddbc8",
  "status": "PENDING",
  "externalId": "3705479006-e7548b87-0c78-4588-9cb3-41a5d987d282",
  "checkoutUrl": "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=3705479006-e7548b87-0c78-4588-9cb3-41a5d987d282"
}
```

Confira que o `externalId` **não** começa com `fake-pref-`: se começar, o
token não foi lido e a API está usando o gateway simulado.

### Passo 9 — Pagar

1. Abra uma **janela anônima** — senão a sessão da sua conta real interfere.
2. Entre em <https://www.mercadopago.com.br> com a **conta de teste
   compradora** do passo 4.
3. Na mesma janela, abra o `checkoutUrl` da resposta.
4. Pague com um **cartão de teste**.

Cartões de teste do Brasil (MLB), todos com validade `11/30`:

| Bandeira         | Número                | CVV    |
| ---------------- | --------------------- | ------ |
| Mastercard       | `5480 8328 0103 3311` | `123`  |
| Visa             | `4235 6477 2802 5682` | `123`  |
| American Express | `3753 651535 56885`   | `1234` |
| Elo (débito)     | `5067 7667 8388 8311` | `123`  |

O resultado **não depende do número do cartão** — quem decide é o **nome do
titular**:

| Nome do titular | Resultado                    | Status final    |
| --------------- | ---------------------------- | --------------- |
| `APRO`          | Aprovado                     | `PAID`          |
| `OTHE`          | Recusado por erro geral      | `FAIL`          |
| `FUND`          | Saldo insuficiente           | `FAIL`          |
| `SECU`          | Código de segurança inválido | `FAIL`          |
| `EXPI`          | Problema de vencimento       | `FAIL`          |
| `CONT`          | Fica pendente                | segue `PENDING` |

No campo **Documento do titular**, use o CPF de teste `12345678909`.

> ⚠️ **A lista de cartões muda.** Números antigos que circulam em tutoriais
> (`5031 4332 1540 6351`, por exemplo) são rejeitados com _"A transação não
> aceita este meio de pagamento"_ — o BIN simplesmente não é mais reconhecido.
> Antes de suspeitar do código, confira o número na
> [lista oficial](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/cards)
> ou valide o BIN direto na API (ver [Quando não funcionar](#quando-não-funcionar)).

**O que observar no log** (`pnpm start:dev` ou `docker compose logs -f app`):

```
[ApplyGatewayPaymentUseCase] Pagamento 552d64a5-... atualizado para PAID
```

E, graças ao `auto_return`, o navegador volta sozinho para
`/api/payment/checkout/return`.

### Passo 10 — Conferir

```bash
curl http://localhost:3000/api/payment/552d64a5-bf9d-4e38-ad66-f5f45e2ddbc8
```

O `status` deve ter virado `PAID` **sozinho** — ninguém chamou o `PUT`. Foi o
callback.

Repetindo o roteiro com titular `OTHE`, o mesmo caminho leva a `FAIL`.

### Passo 11 — (opcional) Ligar a verificação de assinatura

Painel → **Webhooks** → cadastre
`https://<id>.trycloudflare.com/api/payment/webhook`, marque o tópico
_Pagamentos_, salve e copie a **assinatura secreta**:

```env
MERCADO_PAGO_WEBHOOK_SECRET=<assinatura secreta do painel>
```

Reinicie a API. A partir daí, um POST sem assinatura válida no webhook responde
`401` — inclusive o seu próprio `curl`.

### Se você não puder criar conta agora

O projeto ainda sobe, com o gateway simulado — mas entenda o que isso **não**
demonstra: nenhuma chamada ao Mercado Pago acontece, nenhuma preferência é
criada e nenhum callback chega. Serve para ver os endpoints respondendo, não
para validar a integração. Ver
[O gateway simulado](#-o-gateway-simulado--e-o-que-ele-não-é).

### Quando não funcionar

| Sintoma                                                      | Causa provável                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| _"A transação não aceita este meio de pagamento"_            | Número de cartão de teste desatualizado — veja o diagnóstico abaixo                   |
| `externalId` começa com `fake-pref-`                         | Token não foi lido. No modo Docker, confira o `.env.docker` e recrie o container      |
| `502` ao criar com cartão                                    | Token inválido ou expirado — o log traz o status devolvido pelo provedor              |
| Cobrança fica em `PENDING` para sempre                       | O callback não chegou: teste o health check **pelo túnel**                            |
| Webhook responde `401`                                       | `MERCADO_PAGO_WEBHOOK_SECRET` preenchido com valor que não é o do painel              |
| Checkout mostra seu cartão pessoal                           | Navegador logado na conta real — use janela anônima                                   |
| Modo Docker usa credencial que você não pôs no `.env.docker` | O `.env` da máquina fica visível no container pelo volume montado e serve de fallback |
| Porta 3000 ocupada                                           | Os dois modos disputam a mesma porta; rode um de cada vez                             |

#### Diagnosticando um cartão recusado

Dois comandos resolvem quase todos os casos. O primeiro mostra o que a **sua
conta vendedora** aceita:

```bash
curl -s -H "Authorization: Bearer $MERCADO_PAGO_ACCESS_TOKEN" \
  https://api.mercadopago.com/v1/payment_methods \
  | jq -r '.[] | "\(.payment_type_id)  \(.id)  \(.status)"' | sort
```

O segundo diz em que meio de pagamento um **número de cartão** cai — basta o
BIN (os 8 primeiros dígitos):

```bash
curl -s "https://api.mercadopago.com/v1/payment_methods/search?public_key=<SUA_PUBLIC_KEY>&bins=54808328" \
  | jq '.results[0] | {id, payment_type_id, status}'
```

```json
{ "id": "master", "payment_type_id": "credit_card", "status": "active" }
```

`results` vazio significa **BIN não reconhecido** — é o cartão que está
errado, não a integração. E se o BIN cair num `payment_type_id` que não
aparece na primeira lista (um débito quando só há `debelo` ativo, por
exemplo), o checkout recusa pelo mesmo motivo.

---

## ⏱ Temporal.io — fluxo de cartão durável (opcional)

Ligado, cada cobrança por cartão vira um workflow do Temporal. Os arquivos
`.env.example` e `.env.docker.example` já vêm com `TEMPORAL_ENABLED=true`.

Continua opcional: com `TEMPORAL_ENABLED=false` (ou sem a variável) o projeto
se comporta exatamente como antes da integração — nenhuma conexão é aberta,
nenhum endpoint muda, o fluxo de cartão roda dentro da request.

**Quer só testar?** Vá direto para o
[Tutorial](#-tutorial--teste-completo-com-o-temporal).

### O problema que ele resolve

O fluxo síncrono faz tudo dentro da request e não tem rede de segurança:

| Situação                             | Sem Temporal                                | Com Temporal                                       |
| ------------------------------------ | ------------------------------------------- | -------------------------------------------------- |
| Mercado Pago instável (5xx, timeout) | `502`; cobrança fica `PENDING` sem checkout | Retry com backoff; passando de 15s, responde `202` |
| Mercado Pago recusa (token inválido) | `502`; cobrança órfã em `PENDING`           | Sem retry inútil: a cobrança vai para `FAIL`       |
| **Callback nunca chega**             | `PENDING` para sempre                       | **Polling** no Mercado Pago resolve `PAID`/`FAIL`  |
| API cai no meio                      | Depende de onde caiu                        | O workflow retoma do último passo concluído        |
| Onde está a cobrança X?              | Log                                         | UI do Temporal, com o histórico passo a passo      |

O terceiro caso é o mais comum neste projeto: a URL do `pnpm tunnel` **muda a
cada execução**. Um callback apontando para um túnel antigo nunca chega — com
o Temporal, o polling conclui a cobrança mesmo assim, e mesmo sem túnel
nenhum.

### O workflow

```
POST /api/payment (CREDIT_CARD)
  │
  │  Update-with-Start: inicia o workflow E espera o checkout, numa chamada só
  ▼
┌─ creditCardPaymentWorkflow ────────────────────────────────────────────┐
│ 1. registerPayment   grava PENDING (idempotente)                       │
│ 2. startCheckout     cria a preferência — retry: 8x, backoff até 1min  │
│       └─ falhou de vez ──► markPaymentFailed ──► FAIL                  │
│                                                                        │
│    ◄── checkoutUrl volta para o POST (201)                             │
│                                                                        │
│ 3. espera durável, até 60 min:                                         │
│       signal do webhook ───────────► applyNotification                 │
│       a cada 30s sem signal ───────► reconcilePayment                  │
│                                      (busca por external_reference)    │
│ 4. PAID / FAIL gravado ──► fim (SETTLED)                               │
│    prazo vencido ────────► fim (EXPIRED), a cobrança segue PENDING     │
└────────────────────────────────────────────────────────────────────────┘
```

- **Contrato HTTP preservado.** Com Update-with-Start o `POST` continua
  devolvendo `201` com `checkoutUrl`. Só quando a preferência não fica pronta
  em `checkoutWaitMs` (15s) a resposta é `202`, e o workflow segue sozinho.
- **Webhook vira signal.** O `POST /api/payment/webhook` consulta o pagamento
  no Mercado Pago (para saber o `external_reference`) e sinaliza o workflow
  `payment-<id>`. Se o workflow já terminou — prazo vencido, ou cobrança
  criada antes de ligar o Temporal —, a notificação é processada direto, como
  no fluxo síncrono. **Nenhum callback se perde.**
- **Idempotência de graça.** O `workflowId` é `payment-<id do pagamento>`, com
  `USE_EXISTING`: iniciar duas vezes ou sinalizar de novo não duplica nada.
- **Retry que sabe quando parar.** As activities classificam o erro: violação
  de regra de negócio e `4xx` do Mercado Pago são `nonRetryable`; rede,
  timeout, `5xx` e `429` seguem a política de retry.
- **Expirar não é falhar.** No fim da janela a cobrança continua `PENDING` —
  marcar `FAIL` para um cliente que paga no minuto seguinte seria pior. Um
  callback tardio ainda é processado pela API.

### Onde encaixa na arquitetura

Uma porta nova na camada de aplicação, com duas implementações escolhidas por
configuração — o mesmo padrão já usado para o gateway real × simulado:

```ts
// src/modules/payment.module.ts
{
  provide: CreditCardPaymentOrchestratorPort,
  inject: [temporalConfig.KEY, SynchronousCreditCardOrchestrator, TemporalCreditCardOrchestrator],
  useFactory: (config, synchronous, temporal) => (config.enabled ? temporal : synchronous),
}
```

As **activities reaproveitam os casos de uso existentes**
(`StartCheckoutUseCase`, `ProcessPaymentNotificationUseCase`,
`ReconcilePaymentUseCase`, que compartilham o `ApplyGatewayPaymentUseCase`):
a regra de negócio é a mesma nos dois modos, só muda quem conduz. O workflow em si só importa `@temporalio/workflow` e tipos —
ele roda num sandbox determinístico, sem Nest, TypeORM nem I/O.

### Configuração

| Variável                           | Default no código | No `.env.example` | Efeito                                             |
| ---------------------------------- | ----------------- | ----------------- | -------------------------------------------------- |
| `TEMPORAL_ENABLED`                 | `false`           | `true`            | Liga o fluxo durável                               |
| `TEMPORAL_ADDRESS`                 | `localhost:7233`  | `localhost:7233`  | Servidor gRPC (no Docker: `temporal:7233`)         |
| `TEMPORAL_WORKER_ENABLED`          | `true`            | `true`            | `false` tira o worker do processo da API           |
| `TEMPORAL_POLL_INTERVAL_SECONDS`   | `30`              | `30`              | Intervalo do polling enquanto o callback não chega |
| `TEMPORAL_PAYMENT_TIMEOUT_MINUTES` | `60`              | `60`              | Janela em que o workflow acompanha a cobrança      |
| `TEMPORAL_NAMESPACE`               | `default`         | comentada         |                                                    |
| `TEMPORAL_TASK_QUEUE`              | `payments`        | comentada         |                                                    |

A espera do `POST` pela preferência (`checkoutWaitMs`, 15s) fica em
`config/default.yml`. Os prazos são gravados no início de cada workflow:
mudar a config vale para as cobranças novas.

Com `TEMPORAL_ENABLED=true` e o servidor fora do ar, **a API não sobe**, com
uma mensagem dizendo o que fazer. É proposital: quem ligou o Temporal espera
workflows, e descobrir a falta deles só no primeiro pagamento seria pior.

### 🎬 Tutorial — teste completo com o Temporal

Do zero até ver, na UI do Temporal, uma cobrança sair de `PENDING` para
`PAID` — pelo callback e pelo polling — e sobreviver a quedas no meio do
caminho. Em modo dev (API na sua máquina); as diferenças do modo Docker estão
marcadas.

```text
 1. infraestrutura ──► 2. API ──► 3. conhecer a UI
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
  Rota A — sem conta no MP                     Rota B — Mercado Pago real
  (gateway simulado, ~5 min)                   (checkout de verdade, ~20 min)
  webhook à mão ──► signal ──► PAID            B1 polling: paga, SEM túnel ──► PAID
                                               B2 callback: paga, COM túnel ──► PAID
                                               B3 recusa ──► FAIL
              └───────────────────────┬───────────────────────┘
                                      ▼
              4. resiliência: queda da API, worker fora, provedor recusando
                                      ▼
                               5. limpar
```

#### Passo 1 — Subir a infraestrutura

```bash
cp .env.example .env    # se ainda não tem .env
docker compose up -d    # PostgreSQL, Adminer e Temporal
docker compose ps
```

Espere `postgres` e `temporal` aparecerem como `healthy`. Depois abra, lado a
lado:

- **<http://localhost:8233>** — UI do Temporal. A lista de workflows está
  vazia; é aqui que cada cobrança por cartão vai aparecer.
- **<http://localhost:8080>** — Adminer, para ver a tabela `payments` mudando
  junto (servidor `postgres`, usuário e senha `postgres`, base `payments`).
  A tabela `payments` aparece depois do Passo 2, quando a API sobe.

> Já tem um `.env` de antes? Acrescente o bloco `Temporal.io` do
> `.env.example` — no mínimo `TEMPORAL_ENABLED=true`.

**Modo Docker:** pule o `docker compose up -d`; o comando do próximo passo
sobe tudo.

#### Passo 2 — Subir a API

```bash
pnpm start:dev
```

**Modo Docker:** `docker compose --profile docker up --build` (e
`docker compose logs -f app` para ver o log).

Confira as três linhas no log — a do `TemporalWorkerService` é o worker
embutido na API, pronto para executar os workflows:

```text
[TemporalClientService] Conectado ao Temporal em localhost:7233 (namespace default).
[TemporalWorkerService] Worker do Temporal ouvindo a fila "payments".
[Bootstrap] Aplicação rodando em http://localhost:3000
```

#### Passo 3 — Conhecer a UI

A UI do Temporal está para os workflows como o Adminer está para o banco:

| Onde                                     | O que mostra                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| Lista de **Workflows**                   | Uma linha por cobrança (`payment-<uuid>`), com status `Running`/`Completed` |
| Workflow → **History**                   | Cada passo, na ordem: entrada, saída, horário e tentativas de cada activity |
| Workflow → **Pending Activities**        | O que está rodando ou sendo retentado agora, com o último erro              |
| Workflow → **Queries** → `paymentState`  | Estágio atual, status e `checkoutUrl` — sem abrir o banco                   |
| Workflow → link da task queue `payments` | Os workers conectados. Vazio = ninguém executando os workflows              |

O mesmo pela linha de comando, se preferir:

```bash
docker exec payments-temporal temporal workflow list
docker exec payments-temporal temporal workflow show --workflow-id payment-<uuid>
docker exec payments-temporal temporal task-queue describe --task-queue payments
```

#### Rota A — sem conta no Mercado Pago

Mostra a mecânica do workflow com o gateway simulado. Deixe o token vazio no
`.env` e reinicie a API:

```env
MERCADO_PAGO_ACCESS_TOKEN=
```

**A1. Criar a cobrança:**

```bash
curl -X POST http://localhost:3000/api/payment -H "Content-Type: application/json" \
  -d '{"cpf":"52998224725","description":"Tutorial Temporal","amount":15,"paymentMethod":"CREDIT_CARD"}'
```

A resposta é `201` com `externalId: "fake-pref-..."`. Na UI, o workflow
`payment-<id>` aparece como **Running**. No histórico: `registerPayment`,
`startCheckout` e, a cada 30s, um `reconcilePayment` — o polling. No
simulado ele nunca encontra pagamento: o cliente "não pagou".

**A2. Simular o callback.** O log da API traz o id do pagamento simulado:

```text
[FakePaymentGateway] ... Dispare o webhook com providerPaymentId=fake-pay-3d02e98f-...
```

```bash
curl -X POST http://localhost:3000/api/payment/webhook -H "Content-Type: application/json" \
  -d '{"type":"payment","data":{"id":"fake-pay-3d02e98f-..."}}'
```

**A3. Conferir.** O log mostra o webhook virando signal:

```text
[TemporalCreditCardOrchestrator] Notificação fake-pay-... entregue ao workflow do pagamento <id>.
[ApplyGatewayPaymentUseCase] Pagamento <id> atualizado para PAID pela notificação fake-pay-....
```

Na UI o workflow passa a **Completed**, com `WorkflowExecutionSignaled` e
`applyNotification` no histórico e o resultado
`{"status":"PAID","outcome":"SETTLED"}`. O `GET /api/payment/<id>` devolve
`PAID`.

> A Rota A não prova nada sobre a integração com o Mercado Pago — só sobre o
> workflow. Para a integração, siga a Rota B.

#### Rota B — Mercado Pago real

**Pré-requisito:** os passos 1 a 4 do
[Teste ponta a ponta](#-teste-ponta-a-ponta-com-o-mercado-pago) — conta,
aplicação, access token e **conta de teste compradora**. Coloque o token no
`.env` e reinicie a API.

Opcional, para não esperar 30s a cada volta de polling durante o teste:

```env
TEMPORAL_POLL_INTERVAL_SECONDS=10
```

##### B1 — Pagamento concluído pelo polling (sem túnel)

É o que o Temporal traz de novo: **o callback não precisa chegar.** Deixe
`MERCADO_PAGO_NOTIFICATION_URL` e `MERCADO_PAGO_BACK_URL` **comentadas** no
`.env` — ou apontando para um túnel antigo, tanto faz — e não suba túnel
nenhum.

1. Crie a cobrança:

   ```bash
   curl -X POST http://localhost:3000/api/payment -H "Content-Type: application/json" \
     -d '{"cpf":"52998224725","description":"Temporal B1","amount":75.50,"paymentMethod":"CREDIT_CARD"}'
   ```

   `201`, `externalId` real (sem `fake-pref-`) e `checkoutUrl` do Mercado Pago.
   Na UI, o workflow está em **Running**.

2. Pague o `checkoutUrl` em **janela anônima**, logado com a **conta de teste
   compradora**, titular **`APRO`** — cartões e nomes de titular no
   [Passo 9](#passo-9--pagar) do teste ponta a ponta. Sem `back_url`, o
   checkout só mostra o comprovante e não redireciona; é esperado.

3. Na próxima volta do polling, o `reconcilePayment` encontra o pagamento
   (`GET /v1/payments/search?external_reference=<id>`) e grava `PAID`:

   ```text
   [ApplyGatewayPaymentUseCase] Pagamento <id> atualizado para PAID pela notificação <id no MP>.
   ```

   Na UI: o último `reconcilePayment` devolveu `"PAID"` e o workflow está
   **Completed**. Nenhum webhook foi recebido.

   ```bash
   curl http://localhost:3000/api/payment/<id>     # "status": "PAID"
   ```

##### B2 — Pagamento concluído pelo callback (com túnel)

Agora o caminho do webhook, que vira **signal** para o workflow.

1. Suba o túnel e aponte o `.env` para a URL nova — ela muda a cada
   `pnpm tunnel` (detalhes nos passos 5 e 6 do
   [Teste ponta a ponta](#-teste-ponta-a-ponta-com-o-mercado-pago)):

   ```env
   MERCADO_PAGO_NOTIFICATION_URL=https://<id>.trycloudflare.com/api/payment/webhook
   MERCADO_PAGO_BACK_URL=https://<id>.trycloudflare.com
   ```

2. Reinicie a API, crie outra cobrança e pague com `APRO`, como em B1.

3. O callback chega **antes** da próxima volta do polling:

   ```text
   [TemporalCreditCardOrchestrator] Notificação <id no MP> entregue ao workflow do pagamento <id>.
   ```

   Na UI: `WorkflowExecutionSignaled` (`paymentNotification`) seguido de
   `applyNotification` e **Completed**.

> O Mercado Pago pode mandar mais de uma notificação para o mesmo pagamento.
> As que chegam depois de o workflow terminar são processadas direto pela
> API, sem erro — o status já é `PAID` e nada muda.

##### B3 — Recusa

Repita B1 ou B2 com o titular **`OTHE`**. O workflow termina com
`{"status":"FAIL","outcome":"SETTLED"}` e o `GET` devolve `FAIL`.

#### Passo 4 — Resiliência: o que o Temporal promete

Cada cenário abaixo foi executado contra o Mercado Pago real.

**Queda da API no meio da espera.** Crie uma cobrança, espere o workflow
chegar ao polling e derrube a API (`Ctrl+C`, ou matar o processo). Na UI o
workflow segue **Running**, parado. Suba a API de novo: o polling retoma de
onde parou. No histórico, `registerPayment` e `startCheckout` aparecem **uma
vez só** — nada é refeito, e a preferência não é duplicada.

**Worker fora do ar na criação.** No `.env`, `TEMPORAL_WORKER_ENABLED=false`,
e reinicie a API — agora ela só inicia workflows, não os executa.

1. Crie uma cobrança: o `POST` espera 15s e responde **`202`** com
   `checkoutUrl: null`. Na UI, o workflow está **Running** sem nenhum passo
   executado, e a fila `payments` não tem worker.
2. Suba o worker num segundo terminal:

   ```bash
   pnpm start:worker:dev
   ```

3. Em segundos o workflow retoma, grava a cobrança e cria a preferência. O
   `GET /api/payment/<id>` passa a trazer o `checkoutUrl`, com o `createdAt`
   da request original.

> Enquanto nenhum worker rodou, o `GET` desse id responde `404`: quem grava o
> registro é o primeiro passo do workflow. É a troca feita para que a cobrança
> só exista dentro da transação durável — gravar antes, na API, reabriria a
> janela em que uma queda deixa um `PENDING` sem workflow.

Volte `TEMPORAL_WORKER_ENABLED=true` ao terminar.

> Com o **gateway simulado**, não separe API e worker: o simulado guarda os
> pagamentos em memória, e processos diferentes não enxergam a mesma memória.

**Provedor recusando.** Suba a API com um token inválido
(`MERCADO_PAGO_ACCESS_TOKEN=APP_USR-invalido`) e crie uma cobrança: o `POST`
volta em ~1s com **`status: "FAIL"`**. No histórico, `startCheckout` tem
**uma única tentativa** — um `401` não melhora com retry, então a activity
falha como `nonRetryable`. Sem Temporal, o mesmo cenário é um `502` e uma
cobrança órfã em `PENDING`.

#### Passo 5 — Limpar

Workflows de teste que ficaram esperando pagamento seguem **Running** até o
prazo (60 min). Para encerrar todos de uma vez:

```bash
docker exec payments-temporal temporal workflow terminate \
  --query "ExecutionStatus='Running'" --reason "fim do teste" --yes
```

Encerrar o workflow não mexe no banco: a cobrança continua `PENDING`, e um
callback tardio ainda é processado pela API.

```bash
docker compose stop temporal              # para o servidor; o histórico fica no volume
docker compose --profile docker down      # derruba tudo (-v apaga os volumes)
```

#### Quando não funcionar

| Sintoma                                                 | Causa provável                                                                                                               |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| API não sobe: `Temporal indisponível em localhost:7233` | Servidor fora: `docker compose up -d`. Ou desligue com `TEMPORAL_ENABLED=false`                                              |
| Log sem a linha `Conectado ao Temporal`                 | `TEMPORAL_ENABLED` não chegou na API: confira o `.env` (ou o `.env.docker`) e reinicie                                       |
| `POST` demora 15s e responde `202`; `GET` dá `404`      | Nenhum worker rodando: `TEMPORAL_WORKER_ENABLED=false` sem o `pnpm start:worker:dev`                                         |
| Paguei e segue `PENDING`                                | Espere uma volta do polling. Titular `CONT` fica pendente de propósito                                                       |
| Na Rota A, o polling nunca conclui                      | Esperado: o simulado nunca "paga sozinho". Dispare o webhook à mão (A2)                                                      |
| Modo Docker: `Cannot find module '@temporalio/...'`     | Volume `api_node_modules` antigo — ver o aviso em [Modo Docker](#modo-docker--tudo-em-containers)                            |
| Modo Docker: erro ao carregar o `core-bridge`           | Imagem Alpine antiga. A atual é Debian slim: rebuild com o volume novo (ver [Modo Docker](#modo-docker--tudo-em-containers)) |

---

## 🏗 Arquitetura

O projeto segue **Clean Architecture** com as dependências sempre apontando
para dentro, na direção do domínio.

```text
config/                       # YAMLs de configuração (versionados)
├── default.yml
├── production.yml
└── test.yml

src/
├── domain/                   # 🟢 NÚCLEO — zero dependência de framework
│   ├── constants/            # Regras numéricas (faixa de valor, tamanhos)
│   ├── entities/
│   │   ├── payment.entity.ts        # Entidade imutável com as invariantes
│   │   └── repositories/            # Contrato abstrato do repositório
│   ├── enums/                       # PaymentMethod, PaymentStatus
│   ├── exceptions/                  # Exceções puras (estendem Error)
│   └── validation/                  # Regra de CPF (dígitos verificadores)
│
├── application/              # 🔵 CASOS DE USO — sem NestJS
│   ├── exceptions/                  # Falha do provedor de pagamento
│   ├── ports/                       # Portas de saída (gateway, orquestrador, logger, estratégia)
│   ├── orchestrators/               # Fluxo de cartão síncrono (padrão)
│   ├── strategies/                  # Uma estratégia por meio de pagamento
│   └── usecases/payment/
│       ├── create-payment.usecase.ts
│       ├── find-all-payments.usecase.ts
│       ├── find-payment-by-id.usecase.ts
│       ├── update-payment.usecase.ts
│       ├── start-checkout.usecase.ts
│       ├── apply-gateway-payment.usecase.ts   # aplica o status do provedor
│       ├── process-payment-notification.usecase.ts
│       ├── receive-payment-notification.usecase.ts
│       └── reconcile-payment.usecase.ts     # polling no provedor
│
├── infrastructure/           # 🟠 ADAPTERS (implementam os contratos)
│   ├── database/                    # TypeORM: entity, repositório, migrations, data source do CLI
│   ├── gateways/                    # MercadoPagoGateway, FakePaymentGateway
│   ├── logging/                     # Adapter do LoggerPort para o Logger do Nest
│   ├── temporal/                    # Workflow, activities, worker, orquestrador
│   └── swagger/
│
├── presentation/             # 🟣 HTTP
│   ├── controllers/
│   ├── dto/                         # Entrada validada + resposta
│   ├── filters/                     # Domínio e gateway → status HTTP
│   ├── guards/                      # Validação do x-signature do webhook
│   ├── mappers/                     # Entidade → DTO de resposta
│   └── validators/                  # Decorator @IsCpf
│
├── config/                   # Loader YAML, schema Zod, namespaces tipados
├── modules/                  # Wiring do NestJS (único lugar que instancia os casos de uso)
├── app.setup.ts              # Prefixo, versionamento, filtros e ValidationPipe
├── main.ts                   # Bootstrap da API
└── worker.ts                 # Worker do Temporal em processo separado
```

### Regra de dependência, na prática

Três garantias mantêm a direção correta — e todas foram verificadas:

**1. O domínio não conhece framework nenhum.**

As exceções de negócio estendem `Error` puro, **não** `HttpException` do Nest:

```ts
// src/domain/exceptions/domain.exception.ts
export abstract class DomainException extends Error {
  /* ... */
}
export abstract class InvalidInputException extends DomainException {}
export abstract class NotFoundDomainException extends DomainException {}
export abstract class ConflictDomainException extends DomainException {}
```

Quem traduz para HTTP é um filtro **na borda** — o único ponto do sistema que
conhece as duas coisas:

```ts
// src/presentation/filters/domain-exception.filter.ts
@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter<DomainException> {
  private static statusFor(exception: DomainException): HttpStatus {
    if (exception instanceof NotFoundDomainException)
      return HttpStatus.NOT_FOUND;
    if (exception instanceof ConflictDomainException)
      return HttpStatus.CONFLICT;
    if (exception instanceof InvalidInputException)
      return HttpStatus.BAD_REQUEST;
    return HttpStatus.UNPROCESSABLE_ENTITY;
  }
}
```

**2. A camada de aplicação também não conhece o NestJS.**

Casos de uso, estratégias e o orquestrador síncrono são classes TypeScript
puras: sem `@Injectable`, sem `Logger` do Nest. Quem precisa de log recebe um
`LoggerPort`, e o módulo instancia tudo por `useFactory`:

```ts
// src/modules/payment.module.ts
{
  provide: StartCheckoutUseCase,
  inject: [PaymentRepositoryContract, PaymentGatewayPort],
  useFactory: (repository, gateway) =>
    new StartCheckoutUseCase(repository, gateway, new NestLoggerAdapter(StartCheckoutUseCase.name)),
}
```

Trocar o NestJS por outro framework afetaria `modules/`, `presentation/` e
`infrastructure/` — `domain/` e `application/` ficariam intactos.

**3. Camada interna nunca importa camada externa.**

O controller chama os casos de uso diretamente, entregando o id do pagamento no
provedor **já extraído**; quem entende o formato do webhook do Mercado Pago é o
controller. O gateway sinaliza falhas com `PaymentGatewayException` (camada de
aplicação), e só o filtro da borda a traduz para `502`.

### Inversão de dependência

O domínio e os casos de uso conhecem apenas **contratos abstratos**:

| Contrato                            | Onde vive                      | Implementação                                                          | Onde vive                                               |
| ----------------------------------- | ------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| `PaymentRepositoryContract`         | `domain/entities/repositories` | `PaymentRepositoryImpl`                                                | `infrastructure/database`                               |
| `PaymentGatewayPort`                | `application/ports`            | `MercadoPagoGateway` / `FakePaymentGateway`                            | `infrastructure/gateways`                               |
| `CreditCardPaymentOrchestratorPort` | `application/ports`            | `SynchronousCreditCardOrchestrator` / `TemporalCreditCardOrchestrator` | `application/orchestrators` / `infrastructure/temporal` |
| `PaymentMethodStrategy`             | `application/ports`            | `PixPaymentStrategy` / `CreditCardPaymentStrategy`                     | `application/strategies`                                |
| `LoggerPort`                        | `application/ports`            | `NestLoggerAdapter`                                                    | `infrastructure/logging`                                |

A ligação acontece só no wiring:

```ts
// src/modules/payment.module.ts
{ provide: PaymentRepositoryContract, useClass: PaymentRepositoryImpl }
```

Como o token de injeção é a **classe abstrata**, não há `@Inject('STRING_MAGICA')`
e o TypeScript garante a conformidade do adapter.

### Princípios SOLID aplicados

- **(S) Responsabilidade única** — cada caso de uso faz uma operação e expõe
  um único `execute`. Aplicar o status devolvido pelo provedor é um caso de uso
  próprio (`ApplyGatewayPaymentUseCase`), reaproveitado pelo webhook, pela
  reconciliação e pelo Temporal. O mapper só mapeia, o filtro só traduz erro,
  o gateway só fala com o provedor.
- **(O) Aberto/fechado** — trocar o Mercado Pago por outro PSP é escrever um
  novo adapter de `PaymentGatewayPort`; um meio de pagamento novo é uma nova
  `PaymentMethodStrategy`. Nenhum caso de uso muda.
- **(L) Substituição de Liskov** — `MercadoPagoGateway` e `FakePaymentGateway`
  são intercambiáveis em tempo de execução; a aplicação escolhe por configuração.
- **(I) Segregação de interface** — as portas são pequenas e focadas:
  `PaymentGatewayPort` expõe só os três métodos que os casos de uso usam
  (criar a preferência, consultar um pagamento, buscar pela referência), e o
  `LoggerPort` só os dois níveis de log que a aplicação emite.
- **(D) Inversão de dependência** — as camadas internas dependem de abstrações
  que elas mesmas declaram; as concretas vivem fora.

### Tell, don't ask

O caso de uso não manipula o estado da entidade por fora — ele **pede à entidade
que se transforme**:

```ts
// src/application/usecases/payment/update-payment.usecase.ts
if (changesStatus && !payment.allowsManualStatusChange()) {
  throw new ManualStatusChangeNotAllowedException(
    payment.id,
    payment.paymentMethod,
  );
}

let next = input.status ? payment.transitionTo(input.status) : payment;
if (input.description !== undefined) {
  next = next.withDescription(input.description);
}
```

Assim as invariantes são revalidadas a cada mudança, sem o caso de uso conhecer
a estrutura interna do `Payment`.

---

## ⚙️ Configuração

Modelo **híbrido**: estrutura e defaults em **YAML versionado**, segredos em
**variáveis de ambiente**.

```
config/default.yml      # base, commitado — sem segredos
config/production.yml   # overrides de produção
config/test.yml
.env                    # só segredos (gitignored)
```

```yaml
# config/default.yml
database:
  host: ${POSTGRES_HOST:-localhost}
  password: ${POSTGRES_PASSWORD:-postgres}
  synchronize: false # o schema vem das migrations, em todo ambiente
  migrationsRun: true
```

`${VAR}` resolve pelo ambiente; `${VAR:-x}` usa `x` como default. A substituição
acontece **depois do parse do YAML**, percorrendo os valores — fazer no texto
cru quebraria o documento se um segredo contivesse `:`, `#` ou aspas.

### Validação no boot

Um schema **Zod** valida tudo antes de a aplicação subir. Config inválida
**derruba o processo** com a lista completa do que está errado, em vez de virar
`undefined` no meio de uma request:

```
Configuração inválida:
✖ Too small: expected string to have >=1 characters
  → at database.host
✖ MERCADO_PAGO_ACCESS_TOKEN é obrigatório em produção
  → at mercadoPago.accessToken
```

Regras que valem só em produção ficam declaradas no schema, não espalhadas como
`if (NODE_ENV === 'production')` pelo código:

- `synchronize` **não pode** ser `true` (o schema vem das migrations)
- `accessToken`, `notificationUrl` e `webhookSecret` do Mercado Pago são
  **obrigatórios**
- `host`, `username` e `password` do banco **perdem o default** — nada de
  apontar para `localhost` com a conta `postgres` em produção

### Config tipada, sem string mágica

```ts
constructor(
  @Inject(mercadoPagoConfig.KEY)
  private readonly config: ConfigType<typeof mercadoPagoConfig>,
) {}

this.config.timeoutMs;   // number, com autocomplete
```

O tipo é derivado do schema via `z.infer` — não existe interface duplicada para
sair de sincronia.

---

## ✅ Validações

### CPF

Validado pelos **dígitos verificadores (módulo 11)**, não por regex de formato.
A regra vive no domínio (`src/domain/validation/cpf.ts`) e é exposta à camada
HTTP como um decorator:

```ts
@IsCpf()
@Transform(({ value }) => stripCpfMask(value))
cpf: string;
```

Rejeita CPF com dígito verificador inválido e também os "repetidos"
(`111.111.111-11`), que passariam numa checagem ingênua.

### Demais campos

| Campo           | Regra                                                             |
| --------------- | ----------------------------------------------------------------- |
| `amount`        | Numérico, **máximo 2 casas decimais**, entre `0.01` e `1.000.000` |
| `description`   | Obrigatória, até 255 caracteres                                   |
| `paymentMethod` | Enum `PIX` \| `CREDIT_CARD`                                       |
| `status`        | Enum `PENDING` \| `PAID` \| `FAIL`                                |
| `:id`           | UUID validado por `ParseUUIDPipe`                                 |
| `page`          | Inteiro `>= 1` (padrão `1`)                                       |
| `limit`         | Inteiro entre `1` e `100` (padrão `20`)                           |

### Dupla camada de defesa

A validação existe **na borda e no domínio**:

- **Borda** — `ValidationPipe` global com `whitelist` e `forbidNonWhitelisted`:
  campo desconhecido no payload retorna 400 em vez de ser ignorado em silêncio.
- **Domínio** — o construtor de `Payment` revalida CPF, valor e descrição. Mesmo
  que alguém instancie a entidade por outro caminho (um seed, uma migração,
  outro caso de uso), não existe pagamento inválido no sistema.

---

## 🚨 Tratamento de erros

| Situação                                                  | Status | Corpo                                     |
| --------------------------------------------------------- | ------ | ----------------------------------------- |
| Payload inválido                                          | `400`  | Lista de erros por campo                  |
| CPF com dígito inválido                                   | `400`  | `cpf: cpf deve ser um CPF válido`         |
| Pagamento inexistente                                     | `404`  | `PaymentNotFoundException`                |
| Transição de status proibida                              | `409`  | `InvalidPaymentStatusTransitionException` |
| Status de cartão alterado à mão                           | `409`  | `ManualStatusChangeNotAllowedException`   |
| Escrita concorrente                                       | `409`  | `ConcurrentPaymentUpdateException`        |
| Falha na integração externa (HTTP de erro, timeout, rede) | `502`  | `PaymentGatewayException`; detalhe no log |

Erros de validação de entrada saem agrupados, com o caminho do campo:

```json
{
  "statusCode": 400,
  "error": "Erro de validação",
  "message": ["cpf: cpf deve ser um CPF válido"]
}
```

Erros de domínio saem traduzidos pelo filtro:

```json
{
  "statusCode": 409,
  "error": "InvalidPaymentStatusTransitionException",
  "message": "Transição de status inválida: PAID -> FAIL."
}
```

---

## 🧪 Testes

**310 testes unitários em 43 suítes**, mais 9 testes do workflow do Temporal
e 21 testes end-to-end.

```bash
pnpm test           # testes unitários
pnpm test:watch     # modo watch
pnpm test:cov       # com cobertura
pnpm test:e2e       # end-to-end
pnpm test:workflow  # workflow do Temporal, em servidor de teste
```

### Testes do workflow

`pnpm test:workflow` roda o **workflow de verdade** num servidor Temporal de
teste com relógio que pula (`TestWorkflowEnvironment.createTimeSkipping`): a
janela de 1 hora, com polling a cada 30s, executa em segundos. As activities
são dublês — o que está sob teste é a orquestração: Update-with-Start
devolvendo o checkout, signal levando a `PAID`, polling resolvendo sem
callback, expiração, retry de falha transitória, `FAIL` em falha permanente e
idempotência de início duplicado.

Ficam fora do `pnpm test` porque o primeiro run baixa o binário do servidor de
teste, e o `pnpm test` roda no pre-push, que não deve depender de rede.

### Testes end-to-end

`pnpm test:e2e` sobe o `AppModule` inteiro sobre Fastify, com a mesma
configuração do `main.ts` (`configureApp`), e exercita os endpoints por HTTP:
criação PIX e cartão, validações, 404/400 do `GET`, filtros e paginação com
`X-Total-Count`, regras do `PUT` e o webhook levando o cartão a `PAID`. Só
duas peças são trocadas: o Postgres por um repositório em memória
(`test/support`) e o gateway pelo simulado — a suíte não depende de banco,
rede nem credenciais, e força `NODE_ENV=test` para não herdar o `.env` local.

### Organização

Um arquivo de teste **por arquivo testado**, em `__tests__/` ao lado do código:

```text
src/domain/entities/
├── payment.entity.ts
└── __tests__/
    └── payment.entity.spec.ts
```

### O que está coberto

| Camada               | Foco dos testes                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------ |
| **Domínio**          | Máquina de estados, invariantes, imutabilidade, CPF (módulo 11)                            |
| **Casos de uso**     | Estratégia por meio de pagamento; status de cartão não muda à mão; idempotência do webhook |
| **Gateway**          | Corpo da requisição, header de idempotência, tradução de status, `back_urls`, erro HTTP    |
| **Temporal**         | Activities (idempotência, retry × `nonRetryable`), orquestrador (202, fallback do signal)  |
| **Guard do webhook** | Manifesto do HMAC, assinatura forjada, `ts` adulterado, partes ausentes                    |
| **Repositório**      | Mapeamento domínio ↔ persistência, filtros, paginação, lock otimista por `version`         |
| **DTOs**             | Cada regra de validação, com caso positivo e negativo                                      |
| **Config**           | Interpolação de `${VAR}`, merge por ambiente, regras de produção                           |
| **Filtros**          | Cada categoria de exceção → status HTTP correto (`4xx` do domínio, `502` do gateway)       |
| **End-to-end**       | Os endpoints por HTTP, com o `AppModule` completo                                          |

> Os testes usam o gateway simulado de propósito — suíte não depende de rede
> nem de credenciais. A integração real é exercitada à parte, pelo roteiro do
> [Teste ponta a ponta](#-teste-ponta-a-ponta-com-o-mercado-pago).

Os testes usam **mocks manuais** dos contratos, sem container do Nest — rápidos
e sem I/O:

```ts
repo = {
  create: jest.fn(),
} as unknown as jest.Mocked<PaymentRepositoryContract>;
gateway = {
  createCheckoutPreference: jest.fn(),
} as unknown as jest.Mocked<PaymentGatewayPort>;
useCase = new StartCheckoutUseCase(repo, gateway, logger);
```

Isso só é possível porque as dependências são **contratos abstratos** — a
testabilidade é consequência direta da inversão de dependência.

---

## 🔍 Qualidade de código

### Git hooks (Lefthook)

| Hook         | O que roda                                                                          |
| ------------ | ----------------------------------------------------------------------------------- |
| `pre-commit` | ESLint `--fix`, Prettier `--write` e os testes **relacionados** aos arquivos staged |
| `commit-msg` | commitlint — exige **Conventional Commits**                                         |
| `pre-push`   | Suíte completa, typecheck e validação do histórico de commits, em paralelo          |

O `pre-commit` é sequencial de propósito (ESLint e Prettier escrevem nos mesmos
arquivos). O `pre-push` roda em paralelo porque nenhum dos jobs escreve em disco.

A validação de histórico no `pre-push` é a **rede de segurança** para commits
que entraram com `--no-verify`.

### Padrões

- **ESLint 9** (flat config) com `typescript-eslint` e `import/order`
- **Prettier 3**
- **`no-console: error`** — logging é sempre via `Logger` do Nest; na camada
  de aplicação, através do `LoggerPort`

---

## 🐳 Docker

| Arquivo               | Uso                                                         |
| --------------------- | ----------------------------------------------------------- |
| `Dockerfile`          | Imagem de produção, **multi-stage** com `pnpm prune --prod` |
| `Dockerfile.dev`      | Desenvolvimento com hot-reload                              |
| `docker-compose.yml`  | PostgreSQL 17 + Adminer + Temporal + API                    |
| `.env.docker`         | Variáveis injetadas nos containers (**gitignored**)         |
| `.env.docker.example` | Modelo versionado; copie antes da primeira subida           |

A imagem de produção roda como usuário **não-root** (`node`), usa `dumb-init`
como PID 1 e copia apenas `dist/`, `node_modules/`, `package.json` e `config/`.

### Debian slim, não Alpine

As duas imagens partem de `node:24-slim`. O worker do Temporal depende de um
binário nativo (`@temporalio/core-bridge`) publicado só para Linux com
**glibc**; no Alpine, que usa musl, ele não carrega e a API cai na subida com
`TEMPORAL_ENABLED=true`. A imagem fica maior, e em troca o modo Docker roda o
mesmo worker que o modo dev.

### `--ignore-scripts` na instalação

Os dois Dockerfiles instalam as dependências com `--ignore-scripts` — e o
`pnpm prune --prod` da imagem de produção também, porque ele dispara o mesmo
script. O script
`prepare` do `package.json` roda `lefthook install`, que exige **git e um
repositório** — nenhum dos dois existe dentro da imagem, e o build quebra na
primeira camada sem isso.

Git hooks são uma preocupação da máquina do desenvolvedor: ninguém faz commit
de dentro do container. Pular os scripts de lifecycle ali é a resposta certa, e
não afeta o runtime.

O `postgres` tem **healthcheck**, e a API só sobe quando o banco está pronto:

```yaml
depends_on:
  postgres:
    condition: service_healthy
```

---

## 🧭 Decisões técnicas

Algumas escolhas não são óbvias e merecem justificativa.

### TypeScript 5.9, não 7.x

O `typescript@latest` hoje é a **7.0** (o port nativo em Go). Ela não expõe a
API clássica do compilador, e o `ts-jest` declara explicitamente
`typescript: ">=4.3 <7"`. A 6.0 só existe em beta. **5.9.3 é a versão estável
mais recente que o ecossistema suporta.**

### Fastify, não Express

Throughput maior e menor overhead por request — relevante numa API de
pagamentos, que tende a receber picos de webhook.

### `numeric(12,2)` para o valor

Dinheiro em ponto flutuante acumula erro. O Postgres devolve `numeric` como
**string**, e o repositório converte explicitamente na fronteira — comportamento
coberto por teste.

### `fetch` nativo, sem SDK

A integração usa o `fetch` do Node 24 em vez do SDK oficial. O contrato com o
Mercado Pago fica **explícito e legível** no adapter, e o teste mocka `fetch`
sem precisar de camada de abstração extra. Como a chamada está isolada atrás de
uma porta, trocar pelo SDK depois é alterar um arquivo.

### Timeout na chamada externa

`AbortSignal.timeout(config.timeoutMs)` — sem isso, uma indisponibilidade do
provedor seguraria a request até o limite do servidor.

### Nest 12 é ESM-only

O NestJS 12 é distribuído apenas como ESM. O projeto compila para CommonJS e
funciona graças ao `require(esm)` nativo do Node 24. O Jest 30 é a exceção: seu
registry de módulos não usa esse mecanismo, então os scripts de teste rodam com
`NODE_OPTIONS=--experimental-vm-modules`.

---

## 📈 Próximos passos

- [x] Orquestrar o fluxo de cartão com **Temporal.io** (workflow durável, com
      polling de fallback caso o callback não chegue)
- [x] Substituir `synchronize: true` por **migrations** do TypeORM
- [x] Paginação e ordenação na listagem
- [ ] Rate limiting no endpoint de webhook
- [ ] Observabilidade: logs estruturados, métricas e tracing
- [ ] Testes de carga no fluxo de criação
- [ ] Cache de consultas por id

---

## 📂 Scripts

| Script                      | Descrição                                                 |
| --------------------------- | --------------------------------------------------------- |
| `pnpm start:dev`            | Nest em modo watch                                        |
| `pnpm start:dev:ts`         | ts-node-dev (usado no container)                          |
| `pnpm start:prod`           | Executa o build                                           |
| `pnpm build`                | Compila para `dist/`                                      |
| `pnpm test`                 | Testes unitários                                          |
| `pnpm test:cov`             | Cobertura                                                 |
| `pnpm test:e2e`             | End-to-end                                                |
| `pnpm test:related`         | Testes relacionados a arquivos específicos                |
| `pnpm typecheck`            | Checagem de tipos, sem emitir arquivos                    |
| `pnpm lint`                 | ESLint com `--fix`                                        |
| `pnpm format`               | Prettier                                                  |
| `pnpm start:api:docker:dev` | Sobe tudo em containers, API inclusive                    |
| `pnpm infra:up`             | Sobe PostgreSQL, Adminer e Temporal (sem a API)           |
| `pnpm tunnel`               | Expõe a API local numa URL pública (Cloudflare Tunnel)    |
| `pnpm start:worker:dev`     | Worker do Temporal em processo separado (dev)             |
| `pnpm start:worker`         | Worker do Temporal a partir do build                      |
| `pnpm test:workflow`        | Testes do workflow em servidor Temporal de teste          |
| `pnpm migration:run`        | Aplica as migrations pendentes                            |
| `pnpm migration:revert`     | Desfaz a última migration                                 |
| `pnpm migration:generate`   | Gera migration a partir do diff entidades × banco         |
| `pnpm schema:log`           | Mostra o SQL que faltaria para o banco bater com o código |
