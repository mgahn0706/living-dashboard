import OpenAI from "openai";
import { NextResponse } from "next/server";
import { makeInitialBuildPrompt } from "@/lib/llm/makeInitialBuildPrompt";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { attributeKeys = [], attributeTypes = {}, dataSchema = null } =
      await req.json();

    const prompt = makeInitialBuildPrompt({
      attributeKeys,
      attributeTypes,
      dataSchema,
    });

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: prompt.content,
        },
      ],
      temperature: 0.2,
      max_output_tokens: 900,
    });

    console.log("INITIAL BUILD PROMPT:", prompt.content);

    const text = response.output_text?.trim() ?? "";

    console.log("INITIAL BUILD RESPONSE:", response.output_text);

    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      console.error("Initial build returned invalid JSON:", text);
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Initial build API error:", err);
    return NextResponse.json([], { status: 500 });
  }
}
