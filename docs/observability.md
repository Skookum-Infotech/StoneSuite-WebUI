# Observability Runbook

How to see what the backend is doing in production, and how to get alerted when
something breaks. Everything here is on a **free tier** and adds **no extra
infrastructure** (no log-shipper VM, no metrics VM) — so it stays compatible
with scale-to-zero and near-$0 cost.

All of it is **optional and degrades gracefully**: if an env var is unset, that
feature is simply off and the app runs normally.

## At a glance

| Concern | Mechanism | Cost | Enable with |
|---|---|---|---|
| Request/security logs | slog JSON → stdout (always) | $0 | always on |
| Log search + alerts | App ships logs to **Axiom** | $0 (≈500 GB/mo) | `AXIOM_TOKEN`, `AXIOM_DATASET` |
| Metrics + dashboards | `/api/metrics` scraped by Fly's built-in Prometheus/Grafana | $0 | always on (optional `METRICS_TOKEN`) |
| Error/panic tracking | **Sentry** via `middleware.Recover` | $0 (5k/mo) | `SENTRY_DSN` |
| Liveness / readiness | `/api/healthz`, `/api/readyz` | $0 | always on |
| Uptime alerting | External monitor → `/api/healthz` | $0 | see caveat below |

## Health endpoints

- `GET /api/healthz` — **liveness**. Returns 200 if the process is up. Never
  touches the database.
- `GET /api/readyz` — **readiness**. Pings the control-plane DB; 200 if
  reachable, 503 if not.
- `GET /api/metrics` — Prometheus exposition (HTTP request counts/latency + Go
  runtime). If `METRICS_TOKEN` is set, requires `Authorization: Bearer <token>`.

## Logs → Axiom

1. Create a free account at axiom.co, make a dataset (e.g. `stonesuite`), and an
   API token with ingest permission.
2. Set the secrets:
   ```bash
   fly secrets set AXIOM_TOKEN=xaat-xxxx AXIOM_DATASET=stonesuite
   ```
3. Logs now appear in Axiom within seconds. They are still printed to stdout, so
   `fly logs` keeps working.

Useful queries (Axiom APL): filter `security_event == "login_failed"`,
`security_event == "permission_denied"`, `security_event == "idor_denied"`, or
`status >= 500`. Set an Axiom **monitor** to alert (email/Slack) when any of
those exceed a threshold per minute.

How it works: the app adds an `io.Writer` (`logship.Shipper`) alongside stdout;
a background worker batches the JSON lines and POSTs them as `application/x-ndjson`.
Writes never block the request path (full buffer drops lines, counted to stderr).

## Metrics → Fly Grafana

Fly scrapes `/api/metrics` automatically and exposes a managed Grafana — no
setup beyond the endpoint existing. Key series:
- `http_requests_total{method,route,status}` — traffic and error rates.
- `http_request_duration_seconds` — latency histogram.

Routes are normalized (`/records/{id}`) so per-record ids don't explode
cardinality.

## Errors → Sentry

```bash
fly secrets set SENTRY_DSN=https://xxxx@oxxxx.ingest.sentry.io/xxxx
```
Recovered panics are reported with the request id, method, and path. Pivot from
a Sentry issue to the matching log line via `request_id`.

## Uptime monitoring (and the scale-to-zero caveat)

`/api/healthz` is a perfect target for an external monitor (UptimeRobot, Better
Stack — both free). **But there is a real trade-off with scale-to-zero:**

- The app is configured to **stop its Machine when idle** and wake on the next
  request (~1-2s). This is what makes it near-free at idle.
- An external uptime monitor pinging every N minutes will **wake the Machine on
  every ping**, so the Machine runs briefly each interval instead of staying
  fully asleep.

Pick based on what you value:

- **Maximize savings (recommended for now):** don't run an aggressive uptime
  monitor. Rely on Sentry (errors) + Fly's Machine status + Axiom alerts. If you
  want a heartbeat, use a **long interval (30–60 min)** so wakes are rare.
- **Maximize uptime visibility:** monitor `/api/healthz` every 1–5 min and
  accept that the Machine is woken that often (still cheap, just not fully idle).

Do **not** point the monitor at `/api/readyz` for liveness alerting — a brief DB
suspend/resume would show as "down" even though the app is fine.
