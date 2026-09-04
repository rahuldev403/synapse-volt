# ForgeFlow

A visual workflow automation tool. You build a graph of nodes on a canvas — a
webhook comes in, and each node reads what the nodes before it produced. A Go
worker pool executes the graph in dependency order and records every step, so
when a run breaks you can see which node failed and what it received.

```
forgeflow/          Next.js 16 frontend (React Flow canvas, Clerk auth)
forgeflow-backend/  Go API + execution engine (Fiber, pgx, PostgreSQL)
```

## Node types

| Type        | What it does                                                        |
|-------------|---------------------------------------------------------------------|
| `TRIGGER`   | Entry point. The webhook body becomes `{{trigger.*}}` downstream.     |
| `HTTP`      | Calls an external API. Returns `{status, body}`.                     |
| `AI`        | Sends the run context to Gemini, which may call a registered tool.   |
| `CONDITION` | Branches. A false result skips everything reachable only through it. |
| `TRANSFORM` | Reshapes data into a new object for later nodes.                     |
| `DELAY`     | Pauses, capped at 30s.                                               |
| `LOG`       | Writes a resolved message into the run timeline.                     |

Nodes read each other with templates: `{{trigger.email}}`,
`{{steps.<nodeId>.body.total}}`. A template that is the whole value keeps its
type, so `{{trigger.amount}}` stays a number.

## Running it

**1. PostgreSQL**

```bash
cd forgeflow-backend
docker compose up -d              # or point DATABASE_URL at any Postgres
psql "$DATABASE_URL" -f schema.sql
```

Upgrading a database created before the DAG rewrite:

```bash
psql "$DATABASE_URL" -f migrations/001_v1_to_v2.sql
```

It converts the old `next_node_id` linked list into the `edges` table, lays out
node positions, and backfills the new columns. It runs in one transaction and is
safe to re-run.

**2. Backend**

```bash
cd forgeflow-backend
cp .env.example .env      # fill in CLERK_SECRET_KEY, and GEMINI_API_KEY for AI nodes
go run ./cmd/api          # or: air
```

**3. Frontend**

```bash
cd forgeflow
cp .env.example .env      # fill in the Clerk keys
npm install
npm run dev
```

Open http://localhost:3000.

## Tests

```bash
cd forgeflow-backend && go test ./...
cd forgeflow && npx tsc --noEmit && npx eslint .
```

The engine tests cover the topological sort (including cycle detection and
determinism), the template resolver, and each node executor.

## API

Everything under `/api/v1`. All workflow routes require a Clerk bearer token and
verify that the workflow belongs to the caller.

| Method   | Path                                            | Purpose                        |
|----------|-------------------------------------------------|--------------------------------|
| `GET`    | `/health`                                        | Liveness                       |
| `GET`    | `/node-types`                                    | Node catalog the UI renders from |
| `POST`   | `/webhooks/:workflowId`                          | Public ingress → queues a run  |
| `GET`    | `/workflows`                                     | List, with node count and last run |
| `POST`   | `/workflows`                                     | Create                         |
| `GET`    | `/workflows/:id`                                 | Detail                         |
| `PATCH`  | `/workflows/:id`                                 | Rename / pause / resume        |
| `DELETE` | `/workflows/:id`                                 | Delete (cascades)              |
| `GET`    | `/workflows/:id/graph`                           | Nodes + edges                  |
| `GET`    | `/workflows/:id/validate`                        | Problems blocking a run        |
| `POST`   | `/workflows/:id/nodes`                           | Add a node                     |
| `PATCH`  | `/workflows/:id/nodes/:nodeId`                   | Edit config, name, position    |
| `DELETE` | `/workflows/:id/nodes/:nodeId`                   | Delete a node                  |
| `POST`   | `/workflows/:id/edges`                           | Connect two nodes              |
| `DELETE` | `/workflows/:id/edges/:edgeId`                   | Disconnect                     |
| `POST`   | `/workflows/:id/run`                             | Run now, even if paused        |
| `GET`    | `/workflows/:id/executions`                      | Recent runs                    |
| `GET`    | `/workflows/:id/executions/:executionId`         | One run with its step timeline |

## How a run works

1. `POST /webhooks/:id` checks the workflow exists and is active, writes one
   `executions` row, drops the id on a buffered channel, and returns `202`.
2. A worker picks it up, loads the graph, and topologically sorts it. A cycle
   fails the run immediately rather than being retried.
3. One `execution_steps` row is seeded per node, so the UI can show the whole
   timeline before anything has run.
4. Each node runs in dependency order with its own retry budget (3 attempts,
   1s then 2s backoff) and a 45s timeout. Its input, output, attempt count and
   error are written as it goes.
5. A step that already succeeded replays from its stored output instead of
   running again — so retrying a workflow cannot issue the same refund twice.
