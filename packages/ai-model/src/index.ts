export interface ModelRequest {
  system?: string;
  prompt: string;
  modelName?: string;
}

export interface ModelResponse {
  text: string;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
}

/**
 * AI model layer stub. Real Gemini / Vertex calls will be wired later.
 */
export async function generateText(
  request: ModelRequest,
): Promise<ModelResponse> {
  const modelName = request.modelName ?? "stub-model";
  return {
    text: `[stub] No model call made. Prompt length: ${request.prompt.length}`,
    modelName,
    promptTokens: 0,
    completionTokens: 0,
  };
}
