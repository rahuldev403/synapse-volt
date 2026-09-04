package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/rahuldev403/forgeflow/internal/config"
)

const (
	defaultModel = "gemini-2.0-flash"
	apiBase      = "https://generativelanguage.googleapis.com/v1beta/models"
)

var client = &http.Client{Timeout: 30 * time.Second}

type Request struct {
	Model   string
	Prompt  string
	Context string
	Tools   []ToolDeclaration
}

type Result struct {
	Text     string
	ToolName string
	ToolArgs map[string]any
}

// Wire types for the Gemini generateContent API. Modelling the response instead of
// walking `map[string]any` with unchecked assertions means a surprising payload
// returns an error rather than panicking a worker goroutine.
type geminiRequest struct {
	Contents []geminiContent `json:"contents"`
	Tools    []geminiTool    `json:"tools,omitempty"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text         string              `json:"text,omitempty"`
	FunctionCall *geminiFunctionCall `json:"functionCall,omitempty"`
}

type geminiFunctionCall struct {
	Name string         `json:"name"`
	Args map[string]any `json:"args"`
}

type geminiTool struct {
	FunctionDeclarations []ToolDeclaration `json:"function_declarations"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []geminiPart `json:"parts"`
		} `json:"content"`
		FinishReason string `json:"finishReason"`
	} `json:"candidates"`
	PromptFeedback *struct {
		BlockReason string `json:"blockReason"`
	} `json:"promptFeedback"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error"`
}

// Complete sends one prompt plus the run context and returns either the model's
// text or the tool it chose to call.
func Complete(ctx context.Context, req Request) (Result, error) {
	apiKey := config.GetEnv("GEMINI_API_KEY", "")
	if apiKey == "" {
		return Result{}, fmt.Errorf("GEMINI_API_KEY is not set — add it to forgeflow-backend/.env")
	}

	model := strings.TrimSpace(req.Model)
	if model == "" {
		model = defaultModel
	}

	prompt := req.Prompt
	if req.Context != "" {
		prompt = fmt.Sprintf("%s\n\n--- Workflow run context (JSON) ---\n%s", req.Prompt, req.Context)
	}

	body := geminiRequest{
		Contents: []geminiContent{{
			Role:  "user",
			Parts: []geminiPart{{Text: prompt}},
		}},
	}
	if len(req.Tools) > 0 {
		body.Tools = []geminiTool{{FunctionDeclarations: req.Tools}}
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return Result{}, fmt.Errorf("encoding AI request: %w", err)
	}

	url := fmt.Sprintf("%s/%s:generateContent", apiBase, model)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return Result{}, fmt.Errorf("building AI request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	// The key goes in a header rather than the query string so it does not end up in
	// proxy logs or error messages.
	httpReq.Header.Set("x-goog-api-key", apiKey)

	resp, err := client.Do(httpReq)
	if err != nil {
		return Result{}, fmt.Errorf("calling Gemini: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return Result{}, fmt.Errorf("reading Gemini response: %w", err)
	}

	var parsed geminiResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return Result{}, fmt.Errorf("Gemini returned an unreadable response (status %d)", resp.StatusCode)
	}

	if parsed.Error != nil {
		return Result{}, fmt.Errorf("Gemini error %d (%s): %s",
			parsed.Error.Code, parsed.Error.Status, parsed.Error.Message)
	}
	if resp.StatusCode != http.StatusOK {
		return Result{}, fmt.Errorf("Gemini returned status %d", resp.StatusCode)
	}
	if parsed.PromptFeedback != nil && parsed.PromptFeedback.BlockReason != "" {
		return Result{}, fmt.Errorf("Gemini blocked the prompt: %s", parsed.PromptFeedback.BlockReason)
	}
	if len(parsed.Candidates) == 0 {
		return Result{}, fmt.Errorf("Gemini returned no candidates")
	}

	var result Result
	var textParts []string

	for _, part := range parsed.Candidates[0].Content.Parts {
		if part.FunctionCall != nil && part.FunctionCall.Name != "" {
			result.ToolName = part.FunctionCall.Name
			result.ToolArgs = part.FunctionCall.Args
			if result.ToolArgs == nil {
				result.ToolArgs = map[string]any{}
			}
		}
		if part.Text != "" {
			textParts = append(textParts, part.Text)
		}
	}

	result.Text = strings.TrimSpace(strings.Join(textParts, "\n"))
	if result.Text == "" && result.ToolName == "" {
		return Result{}, fmt.Errorf("Gemini returned an empty response (finish reason: %s)",
			parsed.Candidates[0].FinishReason)
	}
	return result, nil
}
