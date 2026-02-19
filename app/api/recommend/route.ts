import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: prompt.content,
        },
      ],
      temperature: 0.2,
      max_output_tokens: 1000,
    });

    console.log("INPUT PROMPT:", prompt.content);

    const text = response.output_text?.trim() ?? "";

    console.log("LLM Response:", response.output_text);

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
