import type { ChatMessage, LLMAdapter, LLMCompletionParams } from "./types";

export class GoogleAdapter implements LLMAdapter {
  constructor(
    private apiKey: string,
    private model: string,
    private baseUrl: string = "https://generativelanguage.googleapis.com/v1beta"
  ) {}

  async complete({ messages, temperature, maxTokens }: LLMCompletionParams): Promise<string> {
    const system = messages.find((m: ChatMessage) => m.role === "system")?.content;
    const conversation = messages.filter((m: ChatMessage) => m.role !== "system");

    const res = await fetch(`${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents: conversation.map((m: ChatMessage) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Google AI request failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  }
}
