var              → function scoped
let/const        → block scoped
TDZ              → inaccessible before initialization
closure          → function retains lexical environment
==               → coercion
===              → strict equality
this             → depends on invocation context
arrow function   → lexical this
prototype        → inheritance mechanism
 
Promise          → async result abstraction
await            → waits for promise inside async function
microtask        → Promise callbacks
task             → timers etc.
event loop       → coordinates async callbacks
 
Node             → JS runtime
V8               → JS engine
libuv            → async I/O/event infrastructure
CPU-bound        → can block event loop
I/O-bound        → Node handles efficiently
worker thread    → CPU-heavy work
stream           → process chunks
Buffer           → binary data
EventEmitter     → event-driven communication
 
middleware       → request/response pipeline
controller       → HTTP layer
service          → business logic
repository       → data access
 
JWT              → token-based auth
authentication   → who are you?
authorization    → what can you do?
 
index            → faster lookup, write/storage cost
cache            → faster repeated access
N+1              → unnecessary repeated DB queries
pooling          → reuse DB connections
 
TypeScript       → static typing
unknown          → safe unknown type
any              → disables type safety
never            → impossible/no-return state
generic          → reusable type-safe abstraction
 
AST              → structure of code
static analysis  → analyze without execution
dependency graph → relationships between code
RAG              → retrieve context before LLM
code agent       → LLM + retrieval + tools + validation