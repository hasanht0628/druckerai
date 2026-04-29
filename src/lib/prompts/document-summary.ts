import { openai, MODEL } from "@/lib/anthropic";

export async function generateDocumentSummary(
  title: string,
  rawText: string
): Promise<string> {
  const truncated =
    rawText.length > 80_000
      ? rawText.slice(0, 80_000) + "\n\n[... document truncated ...]"
      : rawText;

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      {
        role: "system",
        content: `You are a strategic document analyst. Produce a concise 200-300 word distillation of the following document to be used as context by an AI Chief of Staff.

Focus on:
- Core strategic intent and goals
- Key decisions, commitments, or constraints
- OKRs, metrics, or success criteria if present
- Timelines and deadlines
- Who is accountable for what

Write in dense, factual prose. No bullet points. No filler. Every sentence must carry load-bearing information.`,
      },
      {
        role: "user",
        content: `Document title: "${title}"\n\n${truncated}`,
      },
    ],
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}
