import type { ChatMessage, LLMAdapter, LLMCompletionParams } from "./types";

export class AnthropicAdapter implements LLMAdapter {
  constructor(
    private apiKey: string,
    private model: string,
    private baseUrl: string = "https://api.anthropic.com/v1"
  ) {}

  async complete({ messages, temperature, maxTokens }: LLMCompletionParams): Promise<string> {
    const system = messages.find((m: ChatMessage) => m.role === "system")?.content;
    const conversation = messages.filter((m: ChatMessage) => m.role !== "system");

    const res = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        system,
        messages: conversation.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
        temperature,
        max_tokens: maxTokens ?? 2048,
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic request failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text ?? "";
  }
}
