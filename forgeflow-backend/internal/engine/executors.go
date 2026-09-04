package engine

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/rahuldev403/forgeflow/internal/ai"
	"github.com/rahuldev403/forgeflow/internal/domain"
)

// StepResult is what a node hands back to the runner.
type StepResult struct {
	Output map[string]any
	// Pass gates the graph. A CONDITION node that evaluates false returns
	// Pass=false, and everything reachable only through it is marked SKIPPED.
	Pass bool
}

// Executor runs one node type. Adding a node type means adding one of these plus
// an entry in domain.NodeTypeCatalog -- nothing else in the codebase changes.
type Executor func(ctx context.Context, node domain.Node, rc *RunContext) (StepResult, error)

var executors = map[string]Executor{
	domain.NodeTrigger:   execTrigger,
	domain.NodeHTTP:      execHTTP,
	domain.NodeAI:        execAI,
	domain.NodeCondition: execCondition,
	domain.NodeTransform: execTransform,
	domain.NodeDelay:     execDelay,
	domain.NodeLog:       execLog,
}

func executorFor(nodeType string) (Executor, error) {
	exec, ok := executors[nodeType]
	if !ok {
		return nil, fmt.Errorf("no executor registered for node type %q", nodeType)
	}
	return exec, nil
}

// httpClient is shared so connections are pooled across runs instead of building a
// fresh transport per request.
var httpClient = &http.Client{Timeout: 20 * time.Second}

// --- config helpers ---------------------------------------------------------

func cfgString(node domain.Node, key string) string {
	if v, ok := node.Config[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
		return stringify(v)
	}
	return ""
}

func cfgMap(node domain.Node, key string) map[string]any {
	if v, ok := node.Config[key]; ok {
		if m, ok := v.(map[string]any); ok {
			return m
		}
	}
	return map[string]any{}
}

func cfgInt(node domain.Node, key string, fallback int) int {
	v, ok := node.Config[key]
	if !ok {
		return fallback
	}
	switch t := v.(type) {
	case float64:
		return int(t)
	case int:
		return t
	case string:
		if n, err := strconv.Atoi(strings.TrimSpace(t)); err == nil {
			return n
		}
	}
	return fallback
}

// --- executors --------------------------------------------------------------

// The trigger republishes the inbound payload so downstream nodes can read it
// either as {{trigger.x}} or {{steps.<triggerNodeID>.x}}.
func execTrigger(_ context.Context, _ domain.Node, rc *RunContext) (StepResult, error) {
	return StepResult{Output: rc.Trigger, Pass: true}, nil
}

func execHTTP(ctx context.Context, node domain.Node, rc *RunContext) (StepResult, error) {
	method := strings.ToUpper(strings.TrimSpace(cfgString(node, "method")))
	if method == "" {
		method = http.MethodPost
	}

	url := strings.TrimSpace(rc.Resolve(cfgString(node, "url")))
	if url == "" {
		return StepResult{}, fmt.Errorf("HTTP node %q has no URL configured", node.Name)
	}
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
		return StepResult{}, fmt.Errorf("HTTP node %q: URL must start with http:// or https://", node.Name)
	}

	var body io.Reader
	rawBody := strings.TrimSpace(cfgString(node, "body"))
	resolvedBody := ""
	if rawBody != "" && method != http.MethodGet {
		resolvedBody = rc.Resolve(rawBody)
		body = strings.NewReader(resolvedBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return StepResult{}, fmt.Errorf("building request: %w", err)
	}
	if resolvedBody != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range cfgMap(node, "headers") {
		req.Header.Set(k, rc.Resolve(stringify(v)))
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return StepResult{}, fmt.Errorf("request to %s failed: %w", url, err)
	}
	defer resp.Body.Close()

	// Cap the response so one chatty endpoint cannot blow up memory or the JSONB column.
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	if err != nil {
		return StepResult{}, fmt.Errorf("reading response: %w", err)
	}

	// Prefer structured JSON so downstream templates can index into the response.
	var parsed any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		parsed = string(raw)
	}

	out := map[string]any{"status": resp.StatusCode, "body": parsed}

	// A non-2xx is a real failure so the retry policy kicks in, but the output is
	// returned alongside the error so the timeline still shows what came back.
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return StepResult{Output: out, Pass: false},
			fmt.Errorf("%s %s returned %d", method, url, resp.StatusCode)
	}
	return StepResult{Output: out, Pass: true}, nil
}

func execAI(ctx context.Context, node domain.Node, rc *RunContext) (StepResult, error) {
	prompt := strings.TrimSpace(rc.Resolve(cfgString(node, "prompt")))
	if prompt == "" {
		return StepResult{}, fmt.Errorf("AI node %q has no prompt configured", node.Name)
	}

	contextJSON, err := json.MarshalIndent(map[string]any{
		"trigger": rc.Trigger,
		"steps":   rc.Steps,
	}, "", "  ")
	if err != nil {
		contextJSON = []byte("{}")
	}

	result, err := ai.Complete(ctx, ai.Request{
		Model:   cfgString(node, "model"),
		Prompt:  prompt,
		Context: string(contextJSON),
		Tools:   ai.SelectTools(cfgString(node, "tools")),
	})
	if err != nil {
		return StepResult{}, err
	}

	out := map[string]any{"text": result.Text}

	if result.ToolName != "" {
		out["tool"] = result.ToolName
		out["tool_args"] = result.ToolArgs
		out["tool_result"] = ai.ExecuteLocalTool(result.ToolName, result.ToolArgs)
	}

	return StepResult{Output: out, Pass: true}, nil
}

func execCondition(_ context.Context, node domain.Node, rc *RunContext) (StepResult, error) {
	operator := strings.ToLower(strings.TrimSpace(cfgString(node, "operator")))
	if operator == "" {
		operator = "eq"
	}
	left := rc.ResolveValue(cfgString(node, "left"))
	right := rc.ResolveValue(cfgString(node, "right"))

	pass, err := compare(left, operator, right)
	if err != nil {
		return StepResult{}, fmt.Errorf("condition node %q: %w", node.Name, err)
	}

	// A false condition is a legitimate outcome, not an error: the step succeeds and
	// the part of the graph reachable only through it is skipped.
	return StepResult{
		Output: map[string]any{"result": pass, "left": left, "operator": operator, "right": right},
		Pass:   pass,
	}, nil
}

func compare(left any, operator string, right any) (bool, error) {
	switch operator {
	case "exists":
		return left != nil && stringify(left) != "", nil
	case "eq":
		return stringify(left) == stringify(right), nil
	case "neq":
		return stringify(left) != stringify(right), nil
	case "contains":
		return strings.Contains(
			strings.ToLower(stringify(left)),
			strings.ToLower(stringify(right)),
		), nil
	case "gt", "gte", "lt", "lte":
		l, lok := toNumber(left)
		r, rok := toNumber(right)
		if !lok || !rok {
			return false, fmt.Errorf("operator %q needs numbers, got %v and %v", operator, left, right)
		}
		switch operator {
		case "gt":
			return l > r, nil
		case "gte":
			return l >= r, nil
		case "lt":
			return l < r, nil
		default:
			return l <= r, nil
		}
	default:
		return false, fmt.Errorf("unknown operator %q", operator)
	}
}

func toNumber(v any) (float64, bool) {
	switch t := v.(type) {
	case float64:
		return t, true
	case int:
		return float64(t), true
	case bool:
		if t {
			return 1, true
		}
		return 0, true
	case string:
		f, err := strconv.ParseFloat(strings.TrimSpace(t), 64)
		return f, err == nil
	default:
		return 0, false
	}
}

func execTransform(_ context.Context, node domain.Node, rc *RunContext) (StepResult, error) {
	mapping := cfgMap(node, "mapping")
	if len(mapping) == 0 {
		return StepResult{}, fmt.Errorf("transform node %q has no field mapping", node.Name)
	}

	out := make(map[string]any, len(mapping))
	for key, tmpl := range mapping {
		out[key] = rc.ResolveValue(stringify(tmpl))
	}
	return StepResult{Output: out, Pass: true}, nil
}

// maxDelayMS bounds a delay node so a workflow cannot pin a worker indefinitely.
const maxDelayMS = 30000

func cappedDelayMS(node domain.Node) int {
	ms := cfgInt(node, "ms", 1000)
	if ms < 0 {
		return 0
	}
	if ms > maxDelayMS {
		return maxDelayMS
	}
	return ms
}

func execDelay(ctx context.Context, node domain.Node, _ *RunContext) (StepResult, error) {
	ms := cappedDelayMS(node)

	select {
	case <-time.After(time.Duration(ms) * time.Millisecond):
		return StepResult{Output: map[string]any{"waited_ms": ms}, Pass: true}, nil
	case <-ctx.Done():
		return StepResult{}, ctx.Err()
	}
}

func execLog(_ context.Context, node domain.Node, rc *RunContext) (StepResult, error) {
	message := rc.Resolve(cfgString(node, "message"))
	return StepResult{Output: map[string]any{"message": message}, Pass: true}, nil
}

// jsonOrNull marshals a value for a JSONB column, degrading to NULL rather than
// failing a whole run because something in a payload was not serialisable.
func jsonOrNull(v any) []byte {
	if v == nil {
		return nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		b, err = json.Marshal(map[string]string{"_unserialisable": fmt.Sprintf("%T", v)})
		if err != nil {
			return nil
		}
	}
	if bytes.Equal(b, []byte("null")) {
		return nil
	}
	return b
}
