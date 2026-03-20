import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const stream = await client.responses.create({
      model: "gpt-4.1-mini",
      input: messages,
      temperature: 0.4,
      max_output_tokens: 1000,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "response.output_text.delta" &&
              typeof event.delta === "string"
            ) {
              controller.enqueue(encoder.encode(event.delta));
            }
          }
        } catch (err) {
          console.error("Chat stream error:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "Chat request failed" },
      { status: 500 }
    );
  }
}
