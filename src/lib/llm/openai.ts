import type { ChatMessage, LLMAdapter, LLMCompletionParams, LLMCompletionResult } from "./types";

export class OpenAIAdapter implements LLMAdapter {
  constructor(
    private apiKey: string,
    private model: string,
    private baseUrl: string = "https://api.openai.com/v1"
  ) {}

  async complete({ messages, temperature, maxTokens }: LLMCompletionParams): Promise<LLMCompletionResult> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI request failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    return {
      text: data.choices?.[0]?.message?.content ?? "",
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  }
}
