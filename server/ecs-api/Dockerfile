FROM node:22-bookworm-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund \
    && DATABASE_URL=postgresql://localhost:5432/dobha npm run prisma:generate

FROM dependencies AS migration

ENV NODE_ENV=production
COPY src ./src
CMD ["sh", "-c", "if [ ! -d prisma/migrations ] || [ -z \"$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d -print -quit)\" ]; then echo 'No Prisma migrations are committed' >&2; exit 1; fi; exec npm run prisma:migrate:deploy"]

FROM dependencies AS production-dependencies

RUN npm prune --omit=dev --no-audit --no-fund \
    && npm cache clean --force

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --from=dependencies --chown=node:node /app/src/generated/prisma ./src/generated/prisma
COPY --chown=node:node prisma ./prisma

USER node
EXPOSE 3000
CMD ["npm", "start"]
