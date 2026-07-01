# --- Multi-tenant migration sets ---------------------------------------------
# Two separate sets: the shared control-plane schema, and the per-tenant template.
# (The legacy single-tenant migrations were removed with the legacy backend;
# all schema now lives in control_plane/ and tenant/.)
CP_MIGRATIONS_PATH     := backend/database/migrations/control_plane
TENANT_MIGRATIONS_PATH := backend/database/migrations/tenant
# Local control-plane DB (create with: createdb -h localhost -p 5433 -U stonesuite stonesuite_cp)
CP_DB_URL := postgres://stonesuite:stonesuite_secret@localhost:5433/stonesuite_cp?sslmode=disable

# Create a new control-plane migration pair — usage: make migrate-cp-create name=add_sso
migrate-cp-create:
	docker run --rm \
		-v "$(CURDIR)/$(CP_MIGRATIONS_PATH):/migrations" \
		migrate/migrate \
		create -ext sql -dir /migrations -seq $(name)

# Create a new tenant-template migration pair — usage: make migrate-tenant-create name=add_field
migrate-tenant-create:
	docker run --rm \
		-v "$(CURDIR)/$(TENANT_MIGRATIONS_PATH):/migrations" \
		migrate/migrate \
		create -ext sql -dir /migrations -seq $(name)

# --- Control-plane migrations (run against the shared control-plane DB) ------
# Uses host networking (localhost) so it works without the compose network.
migrate-cp-up:
	docker run --rm --network host \
		-v "$(CURDIR)/$(CP_MIGRATIONS_PATH):/migrations" \
		migrate/migrate \
		-path=/migrations -database "$(CP_DB_URL)" up

migrate-cp-down:
	docker run --rm --network host \
		-v "$(CURDIR)/$(CP_MIGRATIONS_PATH):/migrations" \
		migrate/migrate \
		-path=/migrations -database "$(CP_DB_URL)" down 1

# --- Tenant-template migrations (run against ONE tenant DB) -------------------
# Usage: make migrate-tenant-up db="postgres://.../tenant_acme?sslmode=disable"
migrate-tenant-up:
	docker run --rm --network host \
		-v "$(CURDIR)/$(TENANT_MIGRATIONS_PATH):/migrations" \
		migrate/migrate \
		-path=/migrations -database "$(db)" up

.PHONY: migrate-cp-create migrate-tenant-create \
	migrate-cp-up migrate-cp-down migrate-tenant-up
