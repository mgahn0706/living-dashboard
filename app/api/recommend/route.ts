import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    console.log("INPUT PROMPT:", prompt.content);

    const stream = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: prompt.content,
        },
      ],
      temperature: 0.2,
      max_output_tokens: 2000,
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
          console.error("Stream error:", err);
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
    console.error("Recommendation API error:", err);
    return NextResponse.json(
      { reply: "", recommendations: [] },
      { status: 500 }
    );
  }
}
