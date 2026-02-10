import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const response = await client.responses.create({
      model: "chatgpt-4o-latest",
      input: [
        {
          role: "system",
          content: prompt.content,
        },
      ],
      temperature: 0.2,
      max_output_tokens: 1000,
    });

    const text = response.output_text?.trim() ?? "";

    // --- Strict JSON guard ---
    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      console.error("LLM returned invalid JSON:", text);
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Recommendation API error:", err);
    return NextResponse.json([], { status: 500 });
  }
}
