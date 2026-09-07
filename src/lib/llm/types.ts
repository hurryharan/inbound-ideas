export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCompletionParams {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LLMAdapter {
  complete(params: LLMCompletionParams): Promise<string>;
}
