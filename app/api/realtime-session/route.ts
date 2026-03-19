import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const SYSTEM_INSTRUCTIONS = `
You are the voice assistant for Living Dashboard, a collaborative data analysis
environment. You help users explore and understand their data through natural
conversation.

Your role:
- Respond conversationally to the user's analytical questions and observations.
- Acknowledge what the user said and provide brief, insightful commentary.
- When you receive a follow-up message about recommendation results, narrate
  them naturally (e.g. "I have suggested filtering your revenue chart to show
  only Germany and Denmark, and I have also added a new scatter plot comparing
  those countries.").
- Keep responses concise, two to four sentences typically. This is a voice
  interface; long responses are fatiguing.
- Be warm and professional. You are an analytical companion.
- Do NOT use markdown, bullet points, or any formatting. Speak in plain
  sentences suitable for audio.
- Do NOT attempt to generate JSON or structured recommendations. That is
  handled by a separate system. You only narrate and converse.
- If you do not know something, say so briefly and move on.
`.trim();

export async function POST() {
  try {
    const response = await client.realtime.clientSecrets.create({
      session: {
        type: "realtime",
        model: "gpt-4o-mini-realtime-preview",
        instructions: SYSTEM_INSTRUCTIONS,
        output_modalities: ["audio"],
        audio: {
          output: {
            voice: "cedar",
            format: { type: "audio/pcm", rate: 24000 },
          },
        },
        max_output_tokens: 300,
      },
    });

    return NextResponse.json({
      clientSecret: response.value,
      expiresAt: response.expires_at,
    });
  } catch (err) {
    console.error("Realtime session creation error:", err);
    return NextResponse.json(
      { error: "Failed to create realtime session" },
      { status: 500 }
    );
  }
}
