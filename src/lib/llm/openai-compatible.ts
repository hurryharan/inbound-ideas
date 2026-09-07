import { OpenAIAdapter } from "./openai";

/** Any provider that speaks the OpenAI chat-completions wire format (e.g. Groq, Together, local servers). */
export class OpenAICompatibleAdapter extends OpenAIAdapter {
  constructor(apiKey: string, model: string, baseUrl: string) {
    super(apiKey, model, baseUrl);
  }
}
