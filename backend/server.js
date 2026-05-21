import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 3847;
const maxPromptChars = Number(process.env.MAX_PROMPT_CHARS || process.env.MAX_SELECTION_CHARS || 12000);
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const defaultMaxOutputTokens = Number(process.env.MAX_OUTPUT_TOKENS || 140);
const maxOutputTokensCap = Number(process.env.MAX_OUTPUT_TOKENS_CAP || 500);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function createRequestId() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "ai-writing-backend" });
});

app.post("/api/improve", async (req, res) => {
  const requestId = createRequestId();
  const startedAt = Date.now();
  try {
    const prompt = String(req.body?.prompt || "").trim();
    const requestedMaxOutputTokens = Number(req.body?.maxOutputTokens);
    const effectiveMaxOutputTokens = Number.isFinite(requestedMaxOutputTokens)
      ? Math.min(Math.max(1, Math.floor(requestedMaxOutputTokens)), maxOutputTokensCap)
      : defaultMaxOutputTokens;

    console.log(
      `[improve:start] requestId=${requestId} ip=${req.ip} promptChars=${prompt.length} maxOutputTokens=${effectiveMaxOutputTokens}`
    );

    if (!prompt) {
      console.warn(`[improve:invalid] requestId=${requestId} reason=missing_prompt`);
      return res.status(400).json({ error: "Prompt is required." });
    }

    if (prompt.length > maxPromptChars) {
      console.warn(
        `[improve:invalid] requestId=${requestId} reason=prompt_too_long promptChars=${prompt.length} maxPromptChars=${maxPromptChars}`
      );
      return res.status(400).json({
        error: `Prompt is too long. Max ${maxPromptChars} characters.`
      });
    }

    const openAiStartedAt = Date.now();
    const response = await client.responses.create({
      model,
      input: prompt,
      max_output_tokens: effectiveMaxOutputTokens
    });
    const openAiElapsedMs = Date.now() - openAiStartedAt;

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[improve:success] requestId=${requestId} model=${model} maxOutputTokens=${effectiveMaxOutputTokens} resultChars=${(response.output_text || "").length} openAiElapsedMs=${openAiElapsedMs} elapsedMs=${elapsedMs}`
    );

    return res.json({
      result: response.output_text || ""
    });
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    console.error(`[improve:error] requestId=${requestId} elapsedMs=${elapsedMs}`, error);
    return res.status(500).json({ error: "AI request failed." });
  }
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
