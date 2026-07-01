# Dev Workflow — StoneSuite

## Starting Local Dev (New Developer Setup)

### Prerequisites
- **Node.js** 20+ and **npm** 10+
- **Go** 1.25+
- **Docker Desktop** (for PostgreSQL)
- **golangci-lint** — `brew install golangci-lint`

### Step-by-step

```bash
# 1. Clone and enter the repo
git clone <repo-url> StoneSuite
cd StoneSuite

# 2. Start the database
docker compose up -d postgres
# Verify it's healthy:
docker compose ps

# 3. Configure the backend
cp backend/.env.example backend/.env
# Edit backend/.env — at minimum set JWT_SECRET, DB_* matches docker-compose defaults

# 4. Start the Go backend
cd backend
go run .
# Server starts at http://localhost:8080

# 5. In a new terminal, configure the frontend
cd frontend
cp .env.example .env
# Edit .env — set VITE_API_BASE_URL=http://localhost:8080/api

# 6. Install dependencies and start the dev server
npm install
npm run dev
# Vite starts at http://localhost:5173
```

### Optional: Adminer (DB UI)
```bash
docker compose up -d adminer
# Open http://localhost:8081
# System: PostgreSQL, Server: postgres, User: stonesuite, Password: stonesuite_secret, DB: stonesuite
```

---

## Running the Full Test Suite

```bash
# Backend tests
cd backend
go test ./... -v

# Frontend lint (no test runner configured yet)
cd frontend
npm run lint

# TODO: Add Vitest to frontend — see "Adding Tests" below
```

---

## PR Checklist

Before opening a pull request, verify every item:

- [ ] All backend tests pass locally: `cd backend && go test ./...`
- [ ] Backend linter passes: `cd backend && golangci-lint run`
- [ ] Frontend linter passes: `cd frontend && npm run lint`
- [ ] No new `TODO` or `FIXME` without a linked GitHub issue number
- [ ] If any route was added/changed/removed: update `docs/api-contracts.md`
- [ ] If any env var was added/changed: update both `backend/.env.example` and `docs/architecture.md`
- [ ] Conventional commit message used: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`
- [ ] No `.env` files, secrets, or credentials in the diff

---

## How to Add a New React Page / Route

1. **Create the page component** in `frontend/src/pages/`:
   ```tsx
   // frontend/src/pages/ExamplePage.tsx
   export default function ExamplePage() {
     return <div>Example</div>;
   }
   ```

2. **Register the route** in `frontend/src/router/index.tsx`:
   ```tsx
   import ExamplePage from '@/pages/ExamplePage';
   // Add inside the appropriate layout's children array:
   { path: 'example', element: <ExamplePage /> }
   ```

3. If the page fetches data, **add a React Query hook** in `frontend/src/hooks/`:
   ```tsx
   // frontend/src/hooks/useExample.ts
   export function useExample() {
     return useQuery({ queryKey: ['example'], queryFn: exampleService.get });
   }
   ```

4. If the page is behind auth, wrap with a `ProtectedRoute` (TODO: create this component).

---

## How to Add a New Go API Endpoint

Follow this sequence top-to-bottom:

### 1. Add the DB query (if needed) — `backend/database/postgres.go`
```go
func GetSomethingByID(ctx context.Context, id string) (*models.Something, error) {
    row := pgPool.QueryRow(ctx, `SELECT ... FROM something WHERE id=$1`, id)
    // scan + return
}
```

### 2. Add the model (if new shape) — `backend/models/`
```go
type Something struct {
    ID   string `json:"id"`
    Name string `json:"name"`
}
```

### 3. Add business logic (if non-trivial) — `backend/services/`
Create a new file if the domain is new, or add to an existing service file.

### 4. Write the HTTP handler — `backend/controllers/`
```go
// GET /api/something/:id
func GetSomething(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    if r.Method != http.MethodGet {
        w.WriteHeader(http.StatusMethodNotAllowed)
        _ = json.NewEncoder(w).Encode(models.APIResponse{Success: false, Message: "Method not allowed."})
        return
    }
    // ... parse, call DB/service, encode response
}
```

### 5. Register the route — `backend/main.go`
```go
mux.HandleFunc("/api/something", controllers.GetSomething)
// or for protected routes:
mux.Handle("/api/something", middleware.RequireAuth(http.HandlerFunc(controllers.GetSomething)))
```

### 6. Update `docs/api-contracts.md`
Document method, path, request body, response body, auth requirement, and error codes.

---

## Database Migrations

The project currently uses `backend/database/init.sql` — executed automatically on first container start by Docker's entrypoint.

There is **no migration tool configured yet**. For production, consider adopting one of:

- [`golang-migrate`](https://github.com/golang-migrate/migrate) — CLI + library, file-based migrations.
- [`goose`](https://github.com/pressly/goose) — supports Go migration functions alongside SQL files.

**TODO:** Pick a migration tool, add it to `go.mod`, and commit numbered migration files under `backend/database/migrations/`.

### Current schema
See `backend/database/init.sql` for the full schema. The core table is `users` with columns matching `models.User`.

---

## Adding Frontend Tests

No test runner is configured yet. To add Vitest:

```bash
cd frontend
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

Add to `frontend/vite.config.ts`:
```ts
test: {
  environment: 'jsdom',
  globals: true,
  setupFiles: './src/test/setup.ts',
}
```

Place test files next to the component they test: `UserProfile.test.tsx` alongside `UserProfile.tsx`.
