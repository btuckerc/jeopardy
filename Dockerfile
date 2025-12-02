FROM node:20

WORKDIR /app

# Install system dependencies Prisma expects (OpenSSL, ca-certificates)
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies based on the lockfile, but skip lifecycle scripts
# (the "prepare" script runs prisma generate, which needs the schema copied first)
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy the rest of the app, including prisma schema and source
COPY . .

# Copy and setup entrypoint script
COPY scripts/docker-entrypoint.js ./scripts/docker-entrypoint.js
RUN chmod +x ./scripts/docker-entrypoint.js

# Build args for Next.js public env vars (must be available at build time)
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

# Generate Prisma client and build the Next.js app
RUN npm run db:generate && npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Use entrypoint script to run migrations before starting
ENTRYPOINT ["node", "scripts/docker-entrypoint.js"]
CMD ["npm", "run", "start"]
