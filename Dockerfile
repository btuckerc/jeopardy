FROM node:20

WORKDIR /app

# Base image includes required crypto certificates and openssl tooling for Prisma/Node

# Install dependencies based on the lockfile, but skip lifecycle scripts
# (the "prepare" script runs prisma generate, which needs the schema copied first)
COPY package*.json ./
RUN npm config set cache /tmp/.npm-cache --global \
  && npm ci --ignore-scripts --no-audit --no-fund \
  && npm cache clean --force

# Copy the rest of the app, including prisma schema and source
COPY . .

# Copy and setup entrypoint script
COPY scripts/docker-entrypoint.js ./scripts/docker-entrypoint.js
RUN chmod +x ./scripts/docker-entrypoint.js

# Build args for Next.js public env vars (must be available at build time)
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

# Clear any cached Prisma client and regenerate, then build
RUN rm -rf node_modules/.prisma node_modules/@prisma/client && npm run db:generate && npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Use entrypoint script to run migrations before starting
ENTRYPOINT ["node", "scripts/docker-entrypoint.js"]
CMD ["npm", "run", "start"]
