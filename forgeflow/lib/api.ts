import type {
  Execution,
  FlowEdge,
  FlowNode,
  Graph,
  NodeTypeSpec,
  ValidationResult,
  Workflow,
} from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * ApiError carries the server's message so the UI can show what actually went
 * wrong. v1 swallowed responses and showed "Failed to add node" for everything
 * from a validation error to an expired session.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type TokenGetter = () => Promise<string | null>;

async function request<T>(
  path: string,
  init: RequestInit & { getToken?: TokenGetter } = {},
): Promise<T> {
  const { getToken, ...options } = init;

  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (getToken) {
    const token = await getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      cache: "no-store",
    });
  } catch {
    // A network-level failure is almost always "the Go server isn't running",
    // so say that rather than surfacing a bare TypeError.
    throw new ApiError(
      `Cannot reach the ForgeFlow API at ${API_URL}. Is the Go server running?`,
      0,
    );
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? safeParse(text) : null;

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : null) ?? `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * createApi binds a Clerk token getter once, so call sites read as plain data
 * access instead of repeating auth plumbing at every fetch.
 */
export function createApi(getToken: TokenGetter) {
  const authed = <T>(path: string, options: RequestInit = {}) =>
    request<T>(path, { ...options, getToken });

  return {
    listWorkflows: () => authed<Workflow[]>("/api/v1/workflows"),

    getWorkflow: (id: string) => authed<Workflow>(`/api/v1/workflows/${id}`),

    createWorkflow: (body: { name: string; description: string }) =>
      authed<Workflow>("/api/v1/workflows", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    updateWorkflow: (
      id: string,
      body: { name: string; description: string; is_active?: boolean },
    ) =>
      authed<Workflow>(`/api/v1/workflows/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),

    deleteWorkflow: (id: string) =>
      authed<{ id: string }>(`/api/v1/workflows/${id}`, { method: "DELETE" }),

    getGraph: (workflowId: string) =>
      authed<Graph>(`/api/v1/workflows/${workflowId}/graph`),

    validate: (workflowId: string) =>
      authed<ValidationResult>(`/api/v1/workflows/${workflowId}/validate`),

    createNode: (
      workflowId: string,
      body: {
        type: string;
        name?: string;
        position_x: number;
        position_y: number;
      },
    ) =>
      authed<FlowNode>(`/api/v1/workflows/${workflowId}/nodes`, {
        method: "POST",
        body: JSON.stringify(body),
      }),

    updateNode: (
      workflowId: string,
      nodeId: string,
      body: Partial<{
        name: string;
        config: Record<string, unknown>;
        position_x: number;
        position_y: number;
      }>,
    ) =>
      authed<FlowNode>(`/api/v1/workflows/${workflowId}/nodes/${nodeId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),

    deleteNode: (workflowId: string, nodeId: string) =>
      authed<{ id: string }>(
        `/api/v1/workflows/${workflowId}/nodes/${nodeId}`,
        { method: "DELETE" },
      ),

    createEdge: (workflowId: string, source: string, target: string) =>
      authed<FlowEdge>(`/api/v1/workflows/${workflowId}/edges`, {
        method: "POST",
        body: JSON.stringify({
          source_node_id: source,
          target_node_id: target,
        }),
      }),

    deleteEdge: (workflowId: string, edgeId: string) =>
      authed<{ id: string }>(
        `/api/v1/workflows/${workflowId}/edges/${edgeId}`,
        { method: "DELETE" },
      ),

    run: (workflowId: string, payload: unknown) =>
      authed<{ execution_id: string; status: string }>(
        `/api/v1/workflows/${workflowId}/run`,
        { method: "POST", body: JSON.stringify(payload) },
      ),

    listExecutions: (workflowId: string) =>
      authed<Execution[]>(`/api/v1/workflows/${workflowId}/executions?limit=20`),

    getExecution: (workflowId: string, executionId: string) =>
      authed<Execution>(
        `/api/v1/workflows/${workflowId}/executions/${executionId}`,
      ),
  };
}

export type Api = ReturnType<typeof createApi>;

// The node type catalog is public and identical for everyone, so it needs no token.
export const getNodeTypes = () =>
  request<NodeTypeSpec[]>("/api/v1/node-types");

export const webhookUrl = (workflowId: string) =>
  `${API_URL}/api/v1/webhooks/${workflowId}`;
