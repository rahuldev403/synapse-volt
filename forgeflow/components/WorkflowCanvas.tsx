"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Node,
  Edge,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import { Bot, Zap, Loader2, Trash2, Layers, Plus } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

export default function WorkflowCanvas({ workflowId }: { workflowId: string }) {
  const { getToken } = useAuth();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingType, setIsAddingType] = useState<string | null>(null);
  const [deletingNodeId, setDeletingNodeId] = useState<string | null>(null);

  const getApiUrl = () =>
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      setDeletingNodeId(nodeId);
      try {
        const token = await getToken();
        const apiUrl = getApiUrl();
        const res = await fetch(
          `${apiUrl}/api/v1/workflows/${workflowId}/nodes/${nodeId}`,
          {
            method: "DELETE",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Server returned ${res.status}`);
        }

        await fetchNodes();
      } catch (e: any) {
        console.error("Failed to delete node:", e);
        alert(e.message || "Failed to delete node");
      } finally {
        setDeletingNodeId(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workflowId, getToken],
  );

  const fetchNodes = useCallback(async () => {
    try {
      const token = await getToken();
      const apiUrl = getApiUrl();
      const res = await fetch(
        `${apiUrl}/api/v1/workflows/${workflowId}/nodes`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (!res.ok) throw new Error("Failed to fetch nodes");
      const dbNodes = await res.json();

      const flowNodes: Node[] = dbNodes.map((n: any, index: number) => {
        const isAI = n.type === "AI";
        return {
          id: n.id,
          position: { x: 260, y: 70 + index * 140 },
          data: {
            label: (
              <div className="flex items-center justify-between gap-3 w-full group/node">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 transition-transform duration-200 group-hover/node:scale-105 ${
                      isAI
                        ? "bg-yellow-400/20 text-yellow-400 border border-yellow-400/40 shadow-[0_0_15px_rgba(250,204,21,0.25)]"
                        : "bg-white/10 text-white border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.15)]"
                    }`}
                  >
                    {isAI ? <Bot size={17} /> : <Zap size={17} />}
                  </div>
                  <div className="flex flex-col text-left truncate">
                    <span className="text-xs font-bold text-white tracking-tight truncate">
                      {n.name}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                          isAI
                            ? "bg-yellow-400/10 text-yellow-400 border border-yellow-400/30"
                            : "bg-white/10 text-white border border-white/20"
                        }`}
                      >
                        {isAI ? "AI Agent" : "Trigger"}
                      </span>
                      <span className="text-[9px] font-mono text-neutral-500">
                        • step {index + 1}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNode(n.id);
                  }}
                  disabled={deletingNodeId === n.id}
                  title="Delete Node"
                  className="opacity-0 group-hover/node:opacity-100 hover:bg-rose-500/20 hover:text-rose-400 text-neutral-500 p-1.5 rounded-lg transition-all shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {deletingNodeId === n.id ? (
                    <Loader2 size={13} className="animate-spin text-rose-400" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                </button>
              </div>
            ),
          },
          style: {
            background: "rgba(8, 8, 8, 0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            color: "white",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderTop: isAI ? "2px solid #facc15" : "2px solid #ffffff",
            borderRadius: "16px",
            padding: "14px 16px",
            width: 260,
            boxShadow: isAI
              ? "0 -4px 20px rgba(250,204,21,0.25), 0 15px 35px rgba(0,0,0,0.9)"
              : "0 -4px 20px rgba(255,255,255,0.15), 0 15px 35px rgba(0,0,0,0.9)",
          },
        };
      });

      const flowEdges: Edge[] = [];
      dbNodes.forEach((n: any) => {
        if (n.next_node_id) {
          flowEdges.push({
            id: `e-${n.id}-${n.next_node_id}`,
            source: n.id,
            target: n.next_node_id,
            animated: true,
            style: {
              stroke: "#facc15",
              strokeWidth: 2,
              filter: "drop-shadow(0 0 6px rgba(250,204,21,0.5))",
            },
          });
        }
      });

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (error) {
      console.error("Error fetching nodes:", error);
    } finally {
      setIsLoading(false);
    }
  }, [workflowId, getToken, handleDeleteNode, deletingNodeId]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const handleAddNode = async (type: string, name: string) => {
    setIsAddingType(type);
    try {
      const token = await getToken();
      const apiUrl = getApiUrl();
      const res = await fetch(
        `${apiUrl}/api/v1/workflows/${workflowId}/nodes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ name, type, config: {} }),
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned ${res.status}`);
      }

      await fetchNodes();
    } catch (e: any) {
      console.error("Failed to add node:", e);
      alert(e.message || "Failed to add node");
    } finally {
      setIsAddingType(null);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-neutral-500 gap-3 bg-black">
        <div className="relative flex items-center justify-center">
          <Loader2 className="animate-spin text-yellow-400" size={28} />
          <div className="absolute inset-0 bg-yellow-400/20 blur-xl rounded-full" />
        </div>
        <span className="text-xs font-mono tracking-wider text-neutral-400">
          // INITIALIZING CANVAS GRAPH...
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black relative overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.2}
          color="#222222"
        />
        <Controls position="bottom-right" />

        {/* Floating Frosted Node Library Panel */}
        <Panel
          position="top-left"
          className="bg-[#0a0a0a]/90 backdrop-blur-2xl p-4 rounded-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.9)] flex flex-col gap-3 m-4 min-w-[200px]"
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
            <span className="text-[11px] font-mono font-bold text-white tracking-wider uppercase flex items-center gap-1.5">
              <Layers size={13} className="text-yellow-400" />
              Node Library
            </span>
            <span className="text-[10px] font-mono text-yellow-400/80 bg-yellow-400/10 border border-yellow-400/20 px-1.5 py-0.2 rounded">
              {nodes.length} nodes
            </span>
          </div>

          <button
            onClick={() => handleAddNode("TRIGGER", "Webhook Trigger")}
            disabled={isAddingType !== null}
            className="flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.08] text-neutral-200 hover:text-white px-3.5 py-2.5 rounded-xl text-xs font-medium transition border border-white/[0.08] hover:border-white/40 cursor-pointer disabled:opacity-50 group"
          >
            {isAddingType === "TRIGGER" ? (
              <Loader2 size={15} className="text-white animate-spin" />
            ) : (
              <div className="p-1 rounded-md bg-white/10 text-white group-hover:scale-110 transition">
                <Zap size={13} />
              </div>
            )}
            <div className="flex flex-col text-left">
              <span className="font-semibold text-xs text-white">
                Add Trigger
              </span>
              <span className="text-[9px] font-mono text-neutral-400">
                Webhook ingress
              </span>
            </div>
          </button>

          <button
            onClick={() => handleAddNode("AI", "AI Agent")}
            disabled={isAddingType !== null}
            className="flex items-center gap-3 bg-white/[0.03] hover:bg-yellow-400/10 text-neutral-200 hover:text-white px-3.5 py-2.5 rounded-xl text-xs font-medium transition border border-white/[0.08] hover:border-yellow-400/40 cursor-pointer disabled:opacity-50 group"
          >
            {isAddingType === "AI" ? (
              <Loader2 size={15} className="text-yellow-400 animate-spin" />
            ) : (
              <div className="p-1 rounded-md bg-yellow-400/15 text-yellow-400 group-hover:scale-110 transition">
                <Bot size={13} />
              </div>
            )}
            <div className="flex flex-col text-left">
              <span className="font-semibold text-xs text-white">
                Add AI Agent
              </span>
              <span className="text-[9px] font-mono text-neutral-400">
                Tool function calls
              </span>
            </div>
          </button>
        </Panel>

        {nodes.length === 0 && (
          <Panel position="bottom-center" className="mb-6">
            <div className="bg-[#0a0a0a]/90 backdrop-blur-xl border border-yellow-400/30 px-5 py-3 rounded-full text-xs text-neutral-300 flex items-center gap-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
              <span className="h-2 w-2 rounded-full bg-yellow-400 animate-ping" />
              <span className="font-mono text-[11px] text-neutral-300">
                Select a node from the{" "}
                <strong className="text-yellow-400 font-bold">
                  Node Library
                </strong>{" "}
                to construct your pipeline.
              </span>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
