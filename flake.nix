{
  description = "Neo ID — Auth/OIDC provider development environment";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-26.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        pgPort = 5432;
        pgData = ".pgdata";
        dbName = "neo-id";
      in
      {
        devShells.default = pkgs.mkShell {
          name = "neo-id";

          packages = with pkgs; [
            nodejs_24
            corepack
            postgresql_16
            openssl
            git
            curl
            jq
            just
          ];

          shellHook = ''
            export NODE_OPTIONS="--max-old-space-size=4096"
            echo ""
            echo "  neo-id  |  node $(node -v)  |  pnpm $(pnpm --version)"
            echo "  just --list  for available commands"
          '';
        };

        packages.default = pkgs.writeShellApplication {
          name = "neo-id-up";
          runtimeInputs = with pkgs; [
            nodejs_24
            corepack
            postgresql_16
            openssl
            procps
          ];
          text = ''
            set -euo pipefail

            # ── PostgreSQL ────────────────────────────────────
            if [ ! -d "${pgData}" ]; then
              echo "→ Initializing PostgreSQL..."
              initdb -D "${pgData}" --auth=trust --encoding=UTF8 --locale=C
              echo "listen_addresses = '127.0.0.1'" >> "${pgData}/postgresql.conf"
              echo "port = ${toString pgPort}" >> "${pgData}/postgresql.conf"
            fi

            if ! pg_isready -h 127.0.0.1 -p ${toString pgPort} >/dev/null 2>&1; then
              echo "→ Starting PostgreSQL..."
              pg_ctl -D "${pgData}" -l postgres.log start -o "-p ${toString pgPort}"
              # Wait for ready
              for i in $(seq 1 30); do
                pg_isready -h 127.0.0.1 -p ${toString pgPort} >/dev/null 2>&1 && break
                sleep 0.5
              done
            else
              echo "→ PostgreSQL already running"
            fi

            # Create database if not exists
            psql -h 127.0.0.1 -p ${toString pgPort} -U postgres -tAc \
              "SELECT 1 FROM pg_database WHERE datname='${dbName}'" | grep -q 1 \
              || createdb -h 127.0.0.1 -p ${toString pgPort} -U postgres "${dbName}"

            # ── Environment ───────────────────────────────────
            export DATABASE_URL="postgresql://postgres@127.0.0.1:${toString pgPort}/${dbName}"
            export JWT_PRIVATE_KEY
            export JWT_PUBLIC_KEY

            if [ ! -f jwt-private.pem ] || [ ! -f jwt-public.pem ]; then
              echo "→ Generating JWT keys..."
              openssl genrsa -out jwt-private.pem 2048 2>/dev/null
              openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem 2>/dev/null
            fi

            JWT_PRIVATE_KEY="$(awk 'NF{printf "%s\\n",$0}' jwt-private.pem)"
            JWT_PUBLIC_KEY="$(awk 'NF{printf "%s\\n",$0}' jwt-public.pem)"
            export BASE_URL="''${BASE_URL:-http://localhost:3000}"
            export PUBLIC_API_URL="''${PUBLIC_API_URL:-http://localhost:3000}"
            export API_PORT="''${API_PORT:-3000}"
            export CORS_ORIGIN="''${CORS_ORIGIN:-*}"
            export NEXT_PUBLIC_API_URL="''${NEXT_PUBLIC_API_URL:-http://localhost:3000}"
            export WEB_URL="''${WEB_URL:-http://localhost:3001}"

            cp -n .env.example .env 2>/dev/null || true

            # ── Install & Setup ───────────────────────────────
            if [ ! -d node_modules ]; then
              echo "→ Installing dependencies..."
              pnpm install
            fi

            echo "→ Generating Prisma client..."
            pnpm db:generate 2>/dev/null || true

            echo "→ Running migrations..."
            pnpm db:migrate 2>/dev/null || true

            # ── Cleanup on exit ───────────────────────────────
            cleanup() {
              echo ""
              echo "→ Stopping..."
              pkill -f "pnpm.*@neo-id" 2>/dev/null || true
              pkill -f "tsx.*server" 2>/dev/null || true
              pkill -f "next.*dev" 2>/dev/null || true
              pg_ctl -D "${pgData}" stop -m fast 2>/dev/null || true
            }
            trap cleanup EXIT INT TERM

            # ── Start servers ─────────────────────────────────
            echo ""
            echo "  neo-id running:"
            echo "    API  → http://localhost:3000"
            echo "    Web  → http://localhost:3001"
            echo "    PG   → postgresql://postgres@127.0.0.1:${toString pgPort}/${dbName}"
            echo ""
            echo "  Ctrl+C to stop"
            echo ""

            pnpm --filter @neo-id/db dev &
            pnpm --filter @neo-id/api dev &
            pnpm --filter @neo-id/web dev &

            wait
          '';
        };

        # Сброс данных (WARNING: удалит всё)
        packages.reset = pkgs.writeShellApplication {
          name = "neo-id-reset";
          runtimeInputs = with pkgs; [
            postgresql_16
            procps
          ];
          text = ''
            set -euo pipefail
            pg_ctl -D "${pgData}" stop -m fast 2>/dev/null || true
            rm -rf "${pgData}"
            rm -rf packages/db/.prisma
            rm -rf node_modules
            echo "Wiped. Run 'nix run' to start fresh."
          '';
        };
      }
    );
}
