# Debian slim, não Alpine: o worker do Temporal tem um binário nativo
# (@temporalio/core-bridge) publicado só para Linux glibc.

# build stage
FROM node:24-slim AS build
WORKDIR /usr/src/app

RUN corepack enable

# 1) Manifestos primeiro, para aproveitar o cache de camadas
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --ignore-scripts: `prepare` roda `lefthook install`, que exige git e um
# repositório — ausentes na imagem e desnecessários para buildar.
RUN pnpm install --frozen-lockfile --ignore-scripts

# 2) Código-fonte e configs do TypeScript
COPY . .

# 3) Build e remoção das dependências de desenvolvimento
# O prune também dispara o `prepare` (lefthook) — mesmo motivo do install.
RUN pnpm build \
  && pnpm prune --prod --ignore-scripts

# publish stage
FROM node:24-slim AS publish
RUN apt-get update \
  && apt-get install -y --no-install-recommends dumb-init \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
USER node
WORKDIR /usr/src/app

COPY --chown=node:node --from=build /usr/src/app/dist ./dist
COPY --chown=node:node --from=build /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=build /usr/src/app/package.json ./
# Os YAMLs são lidos em runtime a partir de process.cwd().
COPY --chown=node:node --from=build /usr/src/app/config ./config

EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
