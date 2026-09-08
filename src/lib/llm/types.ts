export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCompletionParams {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LLMCompletionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LLMAdapter {
  complete(params: LLMCompletionParams): Promise<LLMCompletionResult>;
}
