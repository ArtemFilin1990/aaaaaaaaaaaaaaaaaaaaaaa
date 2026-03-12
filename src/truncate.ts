const CHARS_PER_TOKEN = 4;
const MAX_TOKENS = 6000;
const MAX_CHARS = MAX_TOKENS * CHARS_PER_TOKEN;

export function truncateResponse(content: unknown): string {
  const text = typeof content === "string" ? content : JSON.stringify(content, null, 2);

  if (text.length <= MAX_CHARS) {
    return text;
  }

  const truncated = text.slice(0, MAX_CHARS);
  const estimatedTokens = Math.ceil(text.length / CHARS_PER_TOKEN);
  const estimatedTokensText = estimatedTokens.toLocaleString("en-US");
  const maxTokensText = MAX_TOKENS.toLocaleString("en-US");

  return `${truncated}\n\n--- TRUNCATED ---\nResponse was ~${estimatedTokensText} tokens (limit: ${maxTokensText}). Use more specific queries to reduce response size.`;
}
