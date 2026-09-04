// Mirrors internal/domain in the Go backend. Kept in one place so a field rename
// on the server surfaces as a type error here rather than an undefined at runtime.

export type ExecutionStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "SKIPPED"
  | "DEAD_LETTER";

export type NodeTypeId =
  | "TRIGGER"
  | "HTTP"
  | "AI"
  | "CONDITION"
  | "TRANSFORM"
  | "DELAY"
  | "LOG";

export interface Workflow {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  node_count: number;
  last_run_status: ExecutionStatus | null;
  last_run_at: string | null;
}

export interface FlowNode {
  id: string;
  workflow_id: string;
  name: string;
  type: NodeTypeId;
  config: Record<string, unknown>;
  position_x: number;
  position_y: number;
  created_at: string;
}

export interface FlowEdge {
  id: string;
  workflow_id: string;
  source_node_id: string;
  target_node_id: string;
}

export interface Graph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FieldSpec {
  key: string;
  label: string;
  kind: "text" | "textarea" | "number" | "select" | "keyvalue" | "code";
  placeholder?: string;
  help?: string;
  options?: string[];
  default?: unknown;
  required?: boolean;
}

export interface NodeTypeSpec {
  type: NodeTypeId;
  label: string;
  category: "trigger" | "action" | "logic";
  description: string;
  icon: string;
  accent: string;
  fields: FieldSpec[];
}

export interface ExecutionStep {
  id: string;
  node_id: string | null;
  node_name: string;
  node_type: NodeTypeId;
  step_order: number;
  status: ExecutionStatus;
  attempt: number;
  input: unknown;
  output: unknown;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface Execution {
  id: string;
  workflow_id: string;
  status: ExecutionStatus;
  trigger_type: "WEBHOOK" | "MANUAL";
  trigger_payload: Record<string, unknown>;
  error: string | null;
  attempts: number;
  started_at: string;
  completed_at: string | null;
  steps?: ExecutionStep[];
}

export interface ValidationResult {
  valid: boolean;
  problems: string[];
  order: string[] | null;
}

// A run is finished when it is no longer moving, which is what tells the panel to
// stop polling.
export const TERMINAL_STATUSES: ExecutionStatus[] = [
  "SUCCESS",
  "FAILED",
  "DEAD_LETTER",
];

export function isTerminal(status: ExecutionStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
