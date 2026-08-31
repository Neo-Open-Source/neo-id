# Neo ID development commands
# Install just: https://just.systems

set dotenv-load

# Show available commands
default:
    @just --list

# Install dependencies
install:
    pnpm install

# Setup everything from scratch
setup:
    @just install
    cp -n .env.example .env 2>/dev/null || true
    @just generate-keys
    pnpm db:generate
    pnpm db:migrate

# Start everything (PostgreSQL + API + Web)
up:
    @just pg-start 2>/dev/null || true
    @just generate-keys 2>/dev/null || true
    @just setup 2>/dev/null || true
    DATABASE_URL="postgresql://postgres@127.0.0.1:5432/neo-id" pnpm dev

# Generate JWT RS256 keys
generate-keys:
    test -f jwt-private.pem || openssl genrsa -out jwt-private.pem 2048
    test -f jwt-public.pem || openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem

# Start dev servers
dev:
    pnpm dev

# Run database migrations
migrate:
    pnpm db:migrate

# Generate Prisma client
generate:
    pnpm db:generate

# Seed database
seed:
    pnpm --filter @neo-id/db exec prisma db seed

# Run linter
lint:
    pnpm lint

# Run tests
test:
    pnpm test

# Build all packages
build:
    pnpm build

# Push schema to database (no migration)
db-push:
    pnpm --filter @neo-id/db exec prisma db push

# Open Prisma Studio
studio:
    pnpm --filter @neo-id/db studio

# Reset database (WARNING: deletes all data)
db-reset:
    rm -rf packages/db/.prisma
    pnpm db:migrate

# Start PostgreSQL (if installed locally)
pg-start:
    pg_ctl -D .pgdata -l postgres.log start -o "-p 5432" 2>/dev/null || \
    (initdb -D .pgdata --auth=trust --encoding=UTF8 --locale=C && \
     echo "listen_addresses = '127.0.0.1'" >> .pgdata/postgresql.conf && \
     echo "port = 5432" >> .pgdata/postgresql.conf && \
     pg_ctl -D .pgdata -l postgres.log start -o "-p 5432")

# Stop PostgreSQL
pg-stop:
    pg_ctl -D .pgdata stop -m fast 2>/dev/null || true

# Wipe everything (WARNING: deletes all data)
reset:
    @just pg-stop 2>/dev/null || true
    rm -rf .pgdata
    rm -rf packages/db/.prisma
    rm -rf node_modules
    echo "Wiped. Run 'just up' to start fresh."
