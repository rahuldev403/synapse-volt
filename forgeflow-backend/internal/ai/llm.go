package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/rahuldev403/forgeflow/internal/config"
)

type GeminiRequest struct {
	Contents []Content                `json:"contents"`
	Tools    []map[string]interface{} `json:"tools,omitempty"`
}

type Content struct {
	Parts []Part `json:"parts"`
}

type Part struct {
	Text string `json:"text"`
}

type GeminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

func AnalyzePayloadWithTools(prompt string, payloadData string, tools map[string]interface{}) (string, map[string]interface{}, error) {
	apiKey := config.GetEnv("GEMINI_API_KEY", "")
	if apiKey == "" {
		return "", nil, fmt.Errorf("GEMINI_API_KEY is not set")
	}

	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=" + apiKey

	fullPrompt := fmt.Sprintf("%s\n\nData:\n%s", prompt, payloadData)

	reqBody := GeminiRequest{
		Contents: []Content{
			{Parts: []Part{{Text: fullPrompt}}},
		},
	}

	if tools != nil {
		reqBody.Tools = []map[string]interface{}{tools}
	}

	jsonData, _ := json.Marshal(reqBody)

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", nil, fmt.Errorf("network error calling AI API: %v", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", nil, fmt.Errorf("AI API returned status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var rawResp map[string]interface{}
	json.Unmarshal(bodyBytes, &rawResp)

	candidates, ok := rawResp["candidates"].([]interface{})
	if ok && len(candidates) > 0 {
		candidate := candidates[0].(map[string]interface{})
		content := candidate["content"].(map[string]interface{})
		parts := content["parts"].([]interface{})

		for _, p := range parts {
			partMap := p.(map[string]interface{})
			if fnCall, exists := partMap["functionCall"].(map[string]interface{}); exists {
				fnName := fnCall["name"].(string)
				fnArgs := fnCall["args"].(map[string]interface{})
				return fnName, fnArgs, nil
			}						
		}
	}

	return "NO_TOOL_CALLED", nil, nil
}
