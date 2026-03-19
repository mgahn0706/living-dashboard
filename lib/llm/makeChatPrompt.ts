export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function makeChatPrompt({
  views,
  dataSchema,
  chatHistory,
}: {
  views: any[];
  dataSchema?: any;
  chatHistory: ChatMessage[];
}): Array<{ role: string; content: string }> {
  const systemMessage = {
    role: "system",
    content: `
You are a conversational data analyst assistant for a dashboard application called Living Dashboard.

Your role is to help users understand their data through natural conversation. You can:
- Answer questions about the dataset's columns, types, and structure
- Explain trends, patterns, or anomalies the user asks about
- Suggest analytical approaches or what to look for
- Provide statistical context or domain-level insights based on the schema
- Describe what the current dashboard views are showing

You do NOT:
- Output JSON
- Generate dashboard modification commands or recommendations
- Suggest adding, removing, or changing dashboard views
- Use markdown code blocks

Respond in clear, concise plain text. Keep responses focused and under 200 words unless the user asks for detail.

DATA SCHEMA:
${dataSchema ? JSON.stringify(dataSchema, null, 2) : "N/A"}

CURRENT DASHBOARD VIEWS (for context only):
${JSON.stringify(
  views.map((v: any) => ({
    id: v.id,
    title: v.title,
    chartType: v.chartType,
    xColumn: v.xColumn,
    yColumn: v.yColumn,
  })),
  null,
  2
)}
`.trim(),
  };

  return [
    systemMessage,
    ...chatHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
  ];
}
