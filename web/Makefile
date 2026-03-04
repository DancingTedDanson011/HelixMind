# HelixMind Web — Production Operations
# Usage: make <target>

.PHONY: help up down restart logs build migrate seed shell db-shell \
        backup restore status health lint type-check test

COMPOSE = docker compose
APP_SERVICE = web
DB_SERVICE = postgres

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ─── Lifecycle ────────────────────────────────────────────────────────────────

up: ## Start all services in detached mode
	$(COMPOSE) up -d --build

down: ## Stop all services
	$(COMPOSE) down

restart: ## Restart the web service only
	$(COMPOSE) restart $(APP_SERVICE)

build: ## Rebuild the web image without cache
	$(COMPOSE) build --no-cache $(APP_SERVICE)

# ─── Monitoring ───────────────────────────────────────────────────────────────

logs: ## Follow logs (all services). Usage: make logs s=web
	$(COMPOSE) logs -f $(if $(s),$(s),)

status: ## Show container status
	$(COMPOSE) ps

health: ## Check /api/health endpoint
	@curl -sf http://localhost:3000/api/health | python3 -m json.tool 2>/dev/null \
		|| echo "Service not responding"

# ─── Database ─────────────────────────────────────────────────────────────────

migrate: ## Run Prisma migrations (inside running container)
	$(COMPOSE) exec $(APP_SERVICE) npx prisma migrate deploy

seed: ## Seed the database (inside running container)
	$(COMPOSE) exec $(APP_SERVICE) npx tsx prisma/seed.ts

db-shell: ## Open a psql shell to the database
	$(COMPOSE) exec $(DB_SERVICE) psql -U $${POSTGRES_USER:-helixmind} $${POSTGRES_DB:-helixmind}

shell: ## Open a shell in the web container
	$(COMPOSE) exec $(APP_SERVICE) sh

# ─── Backup / Restore ─────────────────────────────────────────────────────────

backup: ## Dump database to ./backups/dump_<timestamp>.sql
	@mkdir -p backups
	$(COMPOSE) exec -T $(DB_SERVICE) pg_dump -U $${POSTGRES_USER:-helixmind} $${POSTGRES_DB:-helixmind} \
		> backups/dump_$$(date +%Y%m%d_%H%M%S).sql
	@echo "Backup written to backups/"

restore: ## Restore from a dump. Usage: make restore f=backups/dump_xxx.sql
	@test -n "$(f)" || (echo "Usage: make restore f=<file>" && exit 1)
	$(COMPOSE) exec -T $(DB_SERVICE) psql -U $${POSTGRES_USER:-helixmind} $${POSTGRES_DB:-helixmind} < $(f)

# ─── Dev / CI ─────────────────────────────────────────────────────────────────

lint: ## Run ESLint
	npm run lint

type-check: ## Run TypeScript type check
	npx tsc --noEmit

test: ## Run tests
	npm test
