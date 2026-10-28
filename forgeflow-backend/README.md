# ForgeFlow Backend — Deep Dive

A workflow automation engine written in Go. You build a graph of nodes in the UI,
hit a webhook, and the backend runs every node in the right order — with retries,
live status updates, and conditional branching.

---

## Table of Contents

1. [Big Picture](#big-picture)
2. [Request Journey — From Webhook to 202](#request-journey--from-webhook-to-202)
3. [The Worker Pool (`engine/worker.go`)](#the-worker-pool-engineworkergo)
4. [Running an Execution (`engine/runner.go`)](#running-an-execution-enginerunnergo)
5. [The DAG — Graph & Topological Sort (`engine/dag.go`)](#the-dag--graph--topological-sort-enginedaggo)
6. [Executors — What Each Node Actually Does (`engine/executors.go`)](#executors--what-each-node-actually-does-engineexecutorsgo)
7. [Template Engine (`engine/template.go`)](#template-engine-enginetemplatego)
8. [Graceful Shutdown](#graceful-shutdown)
9. [Folder Map](#folder-map)

---

## Big Picture

```
Webhook POST  ──►  HTTP Handler  ──►  INSERT execution row  ──►  Enqueue(id)  ──►  202 Accepted
                                                                       │
                                               ┌───────────────────────┘
                                               ▼
                                      ┌─────────────────┐
                                      │   Worker Pool   │  (N goroutines, 1 channel)
                                      │  worker 1       │
                                      │  worker 2       │──► runExecution()
                                      │  worker 3       │       │
                                      └─────────────────┘       │
                                                                 ▼
                                                    Build Graph ──► TopoSort ──► run each node
                                                    (DAG check)     (Kahn's)     (with retries)
```

The HTTP handler and the workflow execution are **fully decoupled**. The handler
finishes in milliseconds; the heavy work (AI calls, HTTP requests, delays) runs
on a background goroutine without ever touching the caller's connection.

---

## Request Journey — From Webhook to 202

**File:** [`internal/handlers/webhook.go`](internal/handlers/webhook.go)

```
POST /api/v1/webhooks/:workflowId
```

The handler does exactly four things and nothing more:

| Step | What happens | Why this matters |
|------|-------------|-----------------|
| 1 | Check `workflows` table — does it exist? Is it `is_active`? | Returns an honest 404/409 instead of a mystery 500 |
| 2 | Parse the JSON body into `payload` | The payload becomes `{{trigger.*}}` for every node |
| 3 | `INSERT INTO executions ... RETURNING id` | Gives the run a durable ID before any goroutine touches it |
| 4 | `engine.Enqueue(executionID)` then return **202** | The caller is free immediately; the run continues in the background |

```go
// The entire "start a run" path in one screen
func startExecution(c *fiber.Ctx, workflowID, triggerType string, payload map[string]any) error {
    // ... marshal payload ...
    err = database.DB.QueryRow(...INSERT INTO executions...).Scan(&executionID)

    if err := engine.Enqueue(executionID); err != nil {
        return c.Status(503).JSON(...)  // back-pressure, not a silent drop
    }
    return c.Status(202).JSON(...)      // "got it, will run"
}
```

> **Note:** The execution row is written **before** `Enqueue`. If the process crashes
> the instant after the INSERT and before the goroutine starts, the run is still
> in the database as `PENDING`. A future restart could pick it up.

---

## The Worker Pool (`engine/worker.go`)

This is the heart of the concurrency model. Read this file first.

### What is a worker pool?

Instead of spawning a new goroutine for every incoming execution (which could
mean thousands of simultaneous goroutines under load), the pool keeps a **fixed
number of goroutines alive** and feeds them work through a shared channel.

```
         buffered channel  jobs (cap=100)
         ┌─────────────────────────────────────┐
Enqueue  │  "exec-1"  "exec-2"  "exec-3" ...  │
  ──────►│                                     │
         └───┬─────────────┬─────────────┬─────┘
             │             │             │
             ▼             ▼             ▼
         worker 1      worker 2      worker 3
         (goroutine)   (goroutine)   (goroutine)
```

### The `Pool` struct

```go
// internal/engine/worker.go
type Pool struct {
    jobs   chan string       // buffered channel; strings are execution UUIDs
    wg     sync.WaitGroup   // tracks how many workers are still alive
    ctx    context.Context  // cancelled on Shutdown() to stop all workers
    cancel context.CancelFunc
    once   sync.Once        // makes Shutdown() safe to call multiple times
}
```

### Starting the pool — `Start(workers, queueSize int)`

```go
func Start(workers, queueSize int) *Pool {
    ctx, cancel := context.WithCancel(context.Background())
    p := &Pool{
        jobs:   make(chan string, queueSize),  // buffer = back-pressure knob
        ctx:    ctx,
        cancel: cancel,
    }
    for i := 1; i <= workers; i++ {
        p.wg.Add(1)
        go p.run(i)          // each worker is just a goroutine calling p.run
    }
    return p
}
```

Called once in `main.go`:
```go
pool := engine.Start(
    config.GetEnvInt("ENGINE_WORKERS", 3),      // default: 3 goroutines
    config.GetEnvInt("ENGINE_QUEUE_SIZE", 100), // default: 100 slots
)
```

### The worker loop — `p.run(id int)`

```go
func (p *Pool) run(id int) {
    defer p.wg.Done()

    for {
        select {
        case <-p.ctx.Done():          // shutdown signal received
            return

        case executionID, ok := <-p.jobs:
            if !ok {                  // channel was closed
                return
            }
            status, err := runExecution(p.ctx, id, executionID)
            // log the result, then loop back to wait for the next job
        }
    }
}
```

The `select` statement is the key Go primitive here. Each worker blocks inside
`select`, doing nothing and consuming no CPU, until either:

- A new `executionID` arrives on `p.jobs` → run it
- `p.ctx` is cancelled → shut down cleanly

### Enqueueing — never blocks, never silently drops

```go
func (p *Pool) Enqueue(executionID string) error {
    select {
    case p.jobs <- executionID:   // ✅ channel has space, job accepted
        return nil
    default:                      // ⚡ channel full — back-pressure
        msg := "engine queue is full, try again shortly"
        markExecution(context.Background(), executionID, domain.StatusFailed, &msg)
        return ErrQueueFull
    }
}
```

The `default` branch is what makes this a **non-blocking send**. If all 100
queue slots are full, this returns immediately with `ErrQueueFull`. The
execution row is marked `FAILED` with a reason, so the user sees it in the
timeline instead of it disappearing silently.

Without the `default` branch, `p.jobs <- executionID` would **block the HTTP
handler** until a worker freed a slot — a hidden waterfall of latency under load.

---

## Running an Execution (`engine/runner.go`)

Once a worker picks up an `executionID`, it calls `runExecution()`. This is the
orchestrator that ties everything together.

### The full flow

```
runExecution()
│
├── 1. Load execution row   → get workflowID + trigger payload
├── 2. loadGraph()          → SELECT nodes + edges from DB
├── 3. BuildGraph()         → build adjacency lists (see dag.go)
├── 4. TopoSort()           → get a safe execution order; detect cycles
├── 5. setExecutionRunning()→ flip status to RUNNING in DB
├── 6. seedSteps()          → INSERT one PENDING row per node (UI can render immediately)
├── 7. NewRunContext()      → envelope that carries trigger payload + node outputs
│
└── 8. Loop over nodes in topo order
        │
        ├── isLive()?  No  → markStepSkipped(), continue
        │
        └── Yes → runNodeWithRetries()
                    │
                    ├── loadCompletedStep()  → already succeeded? replay stored output
                    ├── executorFor(type)    → pick the right executor function
                    └── retry loop (up to 3 attempts, exponential backoff 1s→2s)
                            │
                            ├── success → markStepSuccess(), rc.Record(), passed[id]=true
                            └── failure → markStepFailed(), break outer loop
```

### Per-node retries, not per-workflow

```go
const (
    maxNodeAttempts = 3
    nodeTimeout     = 45 * time.Second
)
```

The retry loop in `runNodeWithRetries` is one of the most important design choices:

```go
for attempt := 1; attempt <= maxNodeAttempts; attempt++ {
    nodeCtx, cancel := context.WithTimeout(ctx, nodeTimeout)
    result, err := exec(nodeCtx, node, rc)
    cancel()

    if err == nil {
        markStepSuccess(...)
        return result, nil
    }
    // exponential backoff: 1s after attempt 1, 2s after attempt 2
    backoff := time.Duration(1<<(attempt-1)) * time.Second
    select {
    case <-time.After(backoff):
    case <-ctx.Done():   // shutdown? stop burning retries
        lastErr = ctx.Err()
    }
}
```

**Why per-node?** If node 3 (an HTTP call) is flaky and fails twice then
succeeds, nodes 1 and 2 are *not* re-run. An AI node that already issued a
refund is not called again. This makes retries safe for workflows with side effects.

### Idempotent replay — `loadCompletedStep`

```go
if cached, ok := loadCompletedStep(ctx, executionID, node.ID); ok {
    // already succeeded in a previous attempt → reuse stored output
    return cached, nil
}
```

If a workflow-level retry is ever added, this is what makes it safe. A node
that already wrote `SUCCESS` to `execution_steps` is skipped and its output is
fed into the `RunContext` as if it just ran.

### Conditional branching — `isLive` and `passed`

```go
live   := make(map[string]bool)  // is this node allowed to run?
passed := make(map[string]bool)  // did it output Pass=true?

// roots always run
for _, id := range graph.Roots() {
    live[id] = true
}

for _, nodeID := range order {
    if !isLive(graph, node.ID, live, passed) {
        markStepSkipped(...)
        continue
    }
    live[node.ID] = true  // mark reachable even before we know if it passes

    result, err := runNodeWithRetries(...)
    rc.Record(node.ID, node.Name, result.Output)
    passed[node.ID] = result.Pass   // CONDITION nodes set this to false
}
```

`isLive` checks: *does at least one parent exist in `live` **and** in `passed`?*

```go
func isLive(g *Graph, nodeID string, live, passed map[string]bool) bool {
    parents := g.Parents[nodeID]
    if len(parents) == 0 {
        return true  // root node
    }
    for _, parent := range parents {
        if live[parent] && passed[parent] {
            return true
        }
    }
    return false
}
```

This single rule gives conditional branching for free:

```
TRIGGER → CONDITION (amount > 100) → HTTP (send refund)
                   ↘
                    LOG (skip refund message)

If amount = 50:
  CONDITION.Pass = false
  HTTP node: isLive = false → SKIPPED ✓
  LOG node: isLive = false → SKIPPED ✓ (only reachable through CONDITION)
```

---

## The DAG — Graph & Topological Sort (`engine/dag.go`)

A **Directed Acyclic Graph (DAG)** is the formal name for "a workflow that has
no loops." The engine builds one at runtime from the `nodes` and `edges` DB rows.

### `BuildGraph`

```go
type Graph struct {
    Nodes    map[string]domain.Node    // nodeID → Node
    Children map[string][]string       // nodeID → [childID, ...]
    Parents  map[string][]string       // nodeID → [parentID, ...]
    Indegree map[string]int            // how many incoming edges
}
```

For every edge `A → B`:
- `Children[A]` gets `B` appended
- `Parents[B]` gets `A` appended
- `Indegree[B]++`

Dangling edges (pointing at a deleted node) and duplicate edges are silently
dropped during construction.

### Kahn's Algorithm — `TopoSort`

Kahn's algorithm answers the question: *in what order can we run the nodes such
that every node runs after all its parents?*

```
1. Start: put every node with Indegree=0 into the "ready" queue
2. Pop the front of ready → add it to the output order
3. For each child of that node: decrement its indegree
   If it hits 0, push it to ready
4. Repeat until ready is empty
5. If output has fewer nodes than the graph → there is a cycle
   (those nodes can never reach indegree=0)
```

```go
func (g *Graph) TopoSort() ([]string, error) {
    // ... initialise ready with indegree-0 nodes ...

    for len(ready) > 0 {
        current := ready[0]
        ready = ready[1:]
        order = append(order, current)

        for _, child := range g.Children[current] {
            indegree[child]--
            if indegree[child] == 0 {
                promoted = append(promoted, child)
            }
        }
        // sort promoted by creation order for determinism
        ready = append(ready, promoted...)
    }

    if len(order) != len(g.Nodes) {
        // cycle detected → report which nodes are stuck
        return nil, fmt.Errorf("workflow contains a cycle — these nodes can never run: ...")
    }
    return order, nil
}
```

**Ties are broken by creation timestamp** (`nodeOrder` from the DB query), so
the same graph always runs in the same order. A bug you reproduced yesterday
will reproduce today.

---

## Executors — What Each Node Actually Does (`engine/executors.go`)

Every node type maps to a single function with this signature:

```go
type Executor func(ctx context.Context, node domain.Node, rc *RunContext) (StepResult, error)
```

The registry is just a map:

```go
var executors = map[string]Executor{
    domain.NodeTrigger:   execTrigger,
    domain.NodeHTTP:      execHTTP,
    domain.NodeAI:        execAI,
    domain.NodeCondition: execCondition,
    domain.NodeTransform: execTransform,
    domain.NodeDelay:     execDelay,
    domain.NodeLog:       execLog,
}
```

> **Tip:** Adding a new node type is exactly **two steps**: write an `execXxx` function,
> add it to this map, and add a `NodeTypeSpec` to `domain.NodeTypeCatalog`. Nothing
> else in the codebase needs to change.

### `StepResult`

```go
type StepResult struct {
    Output map[string]any  // becomes available as {{steps.<nodeID>.*}}
    Pass   bool            // false → downstream nodes are SKIPPED
}
```

### Key executor notes

| Node | What it does | Special behaviour |
|------|-------------|-------------------|
| `TRIGGER` | Re-publishes the webhook payload | Makes it accessible as both `{{trigger.*}}` and `{{steps.<id>.*}}` |
| `HTTP` | Fires an HTTP request using a **shared** `http.Client` | Shared client = connection pooling across runs; response capped at 256 KB; non-2xx returns an error so retries kick in |
| `AI` | Calls Gemini with the full run context appended | Can call local tools (`refund_customer`, `escalate_ticket`); tool result is included in output |
| `CONDITION` | Compares left/right using an operator | Returns `Pass=false` on a false condition (not an error); downstream nodes are skipped automatically |
| `TRANSFORM` | Reshapes data into a new object | Each output key is a template that resolves against the current `RunContext` |
| `DELAY` | Sleeps for N milliseconds | Capped at 30 000 ms so a delay node cannot hold a worker forever; respects context cancellation |
| `LOG` | Resolves a message template and stores it | Pure logging; always passes |

---

## Template Engine (`engine/template.go`)

Every string field in a node's config can contain `{{path}}` expressions that
are resolved at runtime against the `RunContext`.

### `RunContext`

```go
type RunContext struct {
    Trigger map[string]any             // the inbound webhook payload
    Steps   map[string]map[string]any  // nodeID → output of that node
    Named   map[string]map[string]any  // node name → same output (friendlier)
}
```

As each node succeeds, `rc.Record(nodeID, nodeName, output)` adds its output to
both `Steps` and `Named`.

### Resolving a template

```
{{trigger.email}}            → rc.Trigger["email"]
{{steps.<uuid>.body.status}} → rc.Steps["<uuid>"]["body"]["status"]
{{steps.Fetch Ticket.body}}  → rc.Named["Fetch Ticket"]["body"]  (by name)
{{email}}                    → rc.Trigger["email"]  (bare path = trigger shorthand)
```

`Resolve(s string) string` replaces all `{{...}}` in a string with their string
representations. `ResolveValue(s string) any` is smarter: if the entire string
is one template, the native type (number, bool, etc.) is preserved — so
`{{trigger.amount}}` stays a `float64` when fed into a `CONDITION` node's
numeric comparison.

---

## Graceful Shutdown

The server shuts down in the right order so in-flight runs are never abandoned:

```go
// cmd/api/main.go
<-quit  // wait for SIGTERM / Ctrl+C

// 1. stop accepting new HTTP requests (20s deadline)
app.ShutdownWithContext(ctx)

// 2. cancel the worker context → workers stop pulling new jobs
//    close the jobs channel → workers drain and exit
//    wait for all WaitGroup counters to reach zero
pool.Shutdown()
```

```go
// engine/worker.go
func (p *Pool) Shutdown() {
    p.once.Do(func() {
        p.cancel()       // signal workers to stop
        close(p.jobs)    // wake up any worker blocked on an empty channel
        p.wg.Wait()      // block until every goroutine has returned
    })
}
```

`sync.Once` ensures `Shutdown()` is idempotent — calling it from a signal
handler and a deferred cleanup at the same time will not close the channel twice
(which would panic).

---

## Folder Map

```
forgeflow-backend/
├── cmd/api/
│   └── main.go              → wires everything together: DB, pool, HTTP server, shutdown
│
├── internal/
│   ├── engine/
│   │   ├── worker.go        ★ goroutine pool — the concurrency backbone
│   │   ├── runner.go        ★ orchestrates one execution end-to-end
│   │   ├── dag.go           ★ builds the graph + Kahn's toposort + cycle detection
│   │   ├── executors.go     ★ one function per node type
│   │   └── template.go      ★ {{trigger.*}} / {{steps.*}} resolution
│   │
│   ├── domain/
│   │   ├── types.go         → Go structs for Workflow, Node, Edge, Execution, ExecutionStep
│   │   └── nodetypes.go     → catalog of node types + their inspector field specs
│   │
│   ├── handlers/
│   │   ├── webhook.go       → POST /webhooks/:id (public) + POST /run (authed)
│   │   ├── execution.go     → GET executions, GET execution detail
│   │   ├── workflow.go      → CRUD for workflows
│   │   ├── node.go          → CRUD for nodes
│   │   ├── edge.go          → CRUD for edges
│   │   └── health.go        → GET /health
│   │
│   ├── middleware/
│   │   └── auth.go          → simple API-key check on protected routes
│   │
│   ├── routes/
│   │   └── routes.go        → registers all routes on the Fiber app
│   │
│   ├── database/
│   │   └── db.go            → pgx connection pool setup
│   │
│   ├── config/
│   │   └── env.go           → reads .env / environment variables
│   │
│   └── ai/
│       ├── llm.go           → Gemini API client
│       └── tools.go         → local tool definitions (refund_customer, escalate_ticket)
│
└── schema.sql               → PostgreSQL schema (workflows, nodes, edges, executions, execution_steps)
```

---

> **The most important invariant:** The HTTP handler never waits for a node to run.
> Every slow operation (AI calls, HTTP requests, delays) happens inside a worker
> goroutine. The webhook caller always gets a `202 Accepted` within milliseconds.
