"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { useAuth } from "@clerk/nextjs";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MousePointerClick,
} from "lucide-react";
import { ApiError, createApi, getNodeTypes } from "@/lib/api";
import { accentFor } from "@/lib/design";
import type {
  Execution,
  ExecutionStatus,
  FlowNode as ApiNode,
  Graph,
  NodeTypeSpec,
  ValidationResult,
} from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { FlowNodeCard, type FlowNodeData } from "./FlowNodeCard";
import NodeLibrary from "./NodeLibrary";
import Inspector from "./Inspector";
import RunPanel from "./RunPanel";

const nodeTypes = { forge: FlowNodeCard };

export default function WorkflowBuilder({
  workflowId,
  workflowName,
}: {
  workflowId: string;
  workflowName: string;
}) {
  return (
    <ReactFlowProvider>
      <Builder workflowId={workflowId} workflowName={workflowName} />
    </ReactFlowProvider>
  );
}

function Builder({
  workflowId,
  workflowName,
}: {
  workflowId: string;
  workflowName: string;
}) {
  const { getToken } = useAuth();
  const toast = useToast();

  // Stable for the life of the component, so effects depending on it do not
  // re-fire every render.
  const api = useMemo(() => createApi(getToken), [getToken]);

  const [specs, setSpecs] = useState<NodeTypeSpec[]>([]);
  const [graph, setGraph] = useState<Graph>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  // The in-flight run lives here rather than inside RunPanel, so the canvas can
  // colour its nodes from the same source without the panel having to push state
  // back up through an effect.
  const [activeRun, setActiveRun] = useState<Execution | null>(null);

  const specByType = useMemo(
    () => new Map(specs.map((spec) => [spec.type, spec])),
    [specs],
  );

  const reportError = useCallback(
    (err: unknown, fallback: string) => {
      const message =
        err instanceof ApiError ? err.message : (err as Error)?.message;
      toast.error(message || fallback);
    },
    [toast],
  );

  // --- loading --------------------------------------------------------------

  const loadGraph = useCallback(async () => {
    try {
      const fresh = await api.getGraph(workflowId);
      setGraph(fresh);
      setLoadError(null);
      return fresh;
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.message : "Could not load this workflow",
      );
      return null;
    }
  }, [api, workflowId]);

  const revalidate = useCallback(async () => {
    try {
      setValidation(await api.validate(workflowId));
    } catch {
      // Validation is advisory; a failure must not block the builder.
      setValidation(null);
    }
  }, [api, workflowId]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const [catalog] = await Promise.allSettled([getNodeTypes(), loadGraph()]);
      if (cancelled) return;

      if (catalog.status === "fulfilled") setSpecs(catalog.value);
      else toast.error("Could not load the node library from the API");

      setLoading(false);
      revalidate();
    };

    // Every state update happens after an await inside bootstrap, so nothing is
    // set synchronously during this effect.
    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [loadGraph, revalidate, toast]);

  // --- projecting the API graph onto React Flow -----------------------------

  // Derived with useMemo, not synced into state by an effect. v1 rebuilt the node
  // array inside its fetch callback and listed transient UI state in the fetch's
  // dependencies, so hovering a delete button re-fetched the entire graph.
  const runStatuses = useMemo(() => {
    const map: Record<string, ExecutionStatus> = {};
    for (const step of activeRun?.steps ?? []) {
      if (step.node_id) map[step.node_id] = step.status;
    }
    return map;
  }, [activeRun]);

  const rfNodes = useMemo<Node[]>(
    () =>
      graph.nodes.map((node) => {
        const spec = specByType.get(node.type);
        return {
          id: node.id,
          type: "forge",
          position: { x: node.position_x, y: node.position_y },
          selected: node.id === selectedId,
          data: {
            label: node.name,
            spec,
            nodeType: node.type,
            runStatus: runStatuses[node.id] ?? null,
            configured: isConfigured(node, spec),
            selected: node.id === selectedId,
          } satisfies FlowNodeData,
        };
      }),
    [graph.nodes, specByType, selectedId, runStatuses],
  );

  const rfEdges = useMemo<Edge[]>(() => {
    const typeById = new Map(graph.nodes.map((n) => [n.id, n.type]));

    return graph.edges.map((edge) => {
      // Colour a connection by the node it leaves, so the canvas shows at a glance
      // which kind of step feeds which.
      const sourceType = typeById.get(edge.source_node_id);
      const spec = sourceType ? specByType.get(sourceType) : undefined;

      return {
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        animated: runStatuses[edge.target_node_id] === "RUNNING",
        style: {
          stroke: accentFor(spec?.accent ?? "slate").stroke,
          strokeWidth: 1.75,
        },
      };
    });
  }, [graph.nodes, graph.edges, specByType, runStatuses]);

  // --- canvas interactions --------------------------------------------------

  // Positions live in `graph`, so a drag updates that rather than a parallel copy
  // of the node list. One source of truth means the canvas cannot drift from what
  // gets saved.
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const moves = changes.filter(
      (change) => change.type === "position" && change.position,
    );
    if (moves.length === 0) return;

    setGraph((current) => ({
      ...current,
      nodes: current.nodes.map((node) => {
        const move = moves.find((m) => "id" in m && m.id === node.id);
        if (!move || move.type !== "position" || !move.position) return node;
        return {
          ...node,
          position_x: move.position.x,
          position_y: move.position.y,
        };
      }),
    }));
  }, []);

  // Persist once the drag ends rather than on every animation frame.
  const onNodeDragStop = useCallback(
    async (_: unknown, node: Node) => {
      try {
        await api.updateNode(workflowId, node.id, {
          position_x: node.position.x,
          position_y: node.position.y,
        });
      } catch (err) {
        reportError(err, "Could not save the new position");
      }
    },
    [api, workflowId, reportError],
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      try {
        const edge = await api.createEdge(
          workflowId,
          connection.source,
          connection.target,
        );
        setGraph((current) => ({ ...current, edges: [...current.edges, edge] }));
        revalidate();
      } catch (err) {
        // The server refuses anything that would create a cycle, so the edge is
        // only drawn once it is accepted.
        reportError(err, "Could not connect those nodes");
      }
    },
    [api, workflowId, revalidate, reportError],
  );

  const onEdgesDelete = useCallback(
    async (deleted: Edge[]) => {
      const removed: string[] = [];
      for (const edge of deleted) {
        try {
          await api.deleteEdge(workflowId, edge.id);
          removed.push(edge.id);
        } catch (err) {
          reportError(err, "Could not remove that connection");
          break;
        }
      }
      if (removed.length > 0) {
        setGraph((current) => ({
          ...current,
          edges: current.edges.filter((e) => !removed.includes(e.id)),
        }));
        revalidate();
      }
    },
    [api, workflowId, revalidate, reportError],
  );

  // --- node CRUD ------------------------------------------------------------

  const addNode = useCallback(
    async (spec: NodeTypeSpec) => {
      setBusy(true);
      try {
        // Stagger new nodes so they do not land on top of each other.
        const index = graph.nodes.length;
        const node = await api.createNode(workflowId, {
          type: spec.type,
          position_x: 160 + (index % 3) * 300,
          position_y: 70 + Math.floor(index / 3) * 190,
        });

        setGraph((current) => ({ ...current, nodes: [...current.nodes, node] }));
        setSelectedId(node.id);
        revalidate();
      } catch (err) {
        reportError(err, "Could not add that node");
      } finally {
        setBusy(false);
      }
    },
    [api, workflowId, graph.nodes.length, revalidate, reportError],
  );

  const saveNode = useCallback(
    async (nodeId: string, name: string, config: Record<string, unknown>) => {
      try {
        const updated = await api.updateNode(workflowId, nodeId, {
          name,
          config,
        });
        setGraph((current) => ({
          ...current,
          nodes: current.nodes.map((n) => (n.id === nodeId ? updated : n)),
        }));
        toast.success("Node saved");
        revalidate();
      } catch (err) {
        reportError(err, "Could not save this node");
      }
    },
    [api, workflowId, toast, revalidate, reportError],
  );

  const deleteNode = useCallback(
    async (nodeId: string) => {
      try {
        await api.deleteNode(workflowId, nodeId);
        setSelectedId(null);
        // Edges touching this node cascade server-side, so reload rather than
        // guessing which ones went with it.
        await loadGraph();
        toast.success("Node deleted");
        revalidate();
      } catch (err) {
        reportError(err, "Could not delete this node");
      }
    },
    [api, workflowId, loadGraph, toast, revalidate, reportError],
  );

  // --- runs -----------------------------------------------------------------

  const runWorkflow = useCallback(
    async (payload: unknown) => {
      try {
        const { execution_id } = await api.run(workflowId, payload);
        return execution_id;
      } catch (err) {
        reportError(err, "Could not start this run");
        return null;
      }
    },
    [api, workflowId, reportError],
  );

  const fetchExecutions = useCallback(async () => {
    try {
      return await api.listExecutions(workflowId);
    } catch {
      return [];
    }
  }, [api, workflowId]);

  const fetchExecution = useCallback(
    async (executionId: string) => {
      try {
        return await api.getExecution(workflowId, executionId);
      } catch {
        return null;
      }
    },
    [api, workflowId],
  );

  const selectedNode = graph.nodes.find((n) => n.id === selectedId) ?? null;

  // --- render ---------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-[#05070b]">
        <Loader2 size={22} className="animate-spin text-amber-400" />
        <p className="text-xs text-slate-500">Loading {workflowName}…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-[#05070b] px-8 text-center">
        <AlertTriangle size={22} className="text-rose-400" />
        <p className="text-sm text-slate-300">{loadError}</p>
        <button
          onClick={() => {
            setLoading(true);
            loadGraph().finally(() => setLoading(false));
          }}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.06]"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <NodeLibrary specs={specs} onAdd={addNode} disabled={busy} />

      <div className="relative min-w-0 flex-1">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onNodeClick={(_, node) => setSelectedId(node.id)}
          onPaneClick={() => setSelectedId(null)}
          // Nodes are deleted from the inspector, so the Delete key only removes
          // connections — one less way to lose work by accident.
          nodesFocusable
          fitView
          fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1}
            color="#1e293b"
          />
          <Controls
            position="bottom-left"
            showInteractive={false}
            className="!border !border-white/10 !bg-[#0c0e14]/90 !shadow-xl"
          />
          <MiniMap
            position="bottom-right"
            pannable
            className="!border !border-white/10 !bg-[#0c0e14]/90"
            maskColor="rgba(5,7,11,0.75)"
            nodeColor={(node) =>
              accentFor(
                (node.data as FlowNodeData)?.spec?.accent ?? "slate",
              ).stroke
            }
          />
        </ReactFlow>

        {graph.nodes.length === 0 && <EmptyCanvasHint />}
        {validation && graph.nodes.length > 0 && (
          <ValidationBanner validation={validation} />
        )}
      </div>

      {selectedNode ? (
        <Inspector
          // Remounting on selection change resets the form to the new node,
          // instead of an effect copying props into state.
          key={selectedNode.id}
          node={selectedNode}
          spec={specByType.get(selectedNode.type)}
          onSave={(name, config) => saveNode(selectedNode.id, name, config)}
          onDelete={() => deleteNode(selectedNode.id)}
          onClose={() => setSelectedId(null)}
        />
      ) : (
        <RunPanel
          workflowId={workflowId}
          activeRun={activeRun}
          onActiveRunChange={setActiveRun}
          onRun={runWorkflow}
          onFetchExecutions={fetchExecutions}
          onFetchExecution={fetchExecution}
        />
      )}
    </div>
  );
}

/** A node is "configured" when every required field in its spec has a value. */
function isConfigured(node: ApiNode, spec: NodeTypeSpec | undefined): boolean {
  if (!spec) return true;
  return spec.fields
    .filter((field) => field.required)
    .every((field) => {
      const value = node.config[field.key];
      if (value == null) return false;
      if (typeof value === "string") return value.trim() !== "";
      return true;
    });
}

function EmptyCanvasHint() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="flex max-w-xs flex-col items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0c0e14]/90 px-6 py-5 text-center backdrop-blur-sm">
        <MousePointerClick size={20} className="text-amber-400" />
        <p className="text-sm font-medium text-slate-200">
          Start with a trigger
        </p>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Pick a node from the library on the left. Then drag from the dot on its
          bottom edge to the top of another node to connect them.
        </p>
      </div>
    </div>
  );
}

function ValidationBanner({ validation }: { validation: ValidationResult }) {
  if (validation.valid) {
    return (
      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-950/70 px-3 py-1.5 backdrop-blur-sm">
        <CheckCircle2 size={11} className="text-emerald-400" />
        <span className="text-[10px] text-emerald-300">Ready to run</span>
      </div>
    );
  }

  return (
    <div className="absolute left-1/2 top-3 max-w-md -translate-x-1/2 rounded-lg border border-amber-400/25 bg-amber-950/70 px-3 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-1.5">
        <AlertTriangle size={11} className="shrink-0 text-amber-400" />
        <span className="text-[10px] font-medium text-amber-300">
          {validation.problems.length} thing
          {validation.problems.length === 1 ? "" : "s"} to fix before this runs
        </span>
      </div>
      <ul className="mt-1 space-y-0.5 pl-4">
        {validation.problems.slice(0, 3).map((problem) => (
          <li
            key={problem}
            className="list-disc text-[10px] leading-relaxed text-amber-200/70"
          >
            {problem}
          </li>
        ))}
      </ul>
    </div>
  );
}
