import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";
import { ACTIONS, DEFAULT_ACTION_ID, resolveAction } from "./config/actions.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3847;
const maxChars = Number(process.env.MAX_SELECTION_CHARS || 4000);
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const defaultMaxOutputTokens = Number(process.env.MAX_OUTPUT_TOKENS || 140);

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

app.get("/api/actions", (_req, res) => {
  return res.json({
    defaultActionId: DEFAULT_ACTION_ID,
    actions: ACTIONS.map((action) => ({
      id: action.id,
      label: action.label
    }))
  });
});

app.post("/api/improve", async (req, res) => {
  const requestId = createRequestId();
  const startedAt = Date.now();
  try {
    const selectedText = String(req.body?.selectedText || "").trim();
    const actionId = String(req.body?.actionId || DEFAULT_ACTION_ID).trim() || DEFAULT_ACTION_ID;
    const action = resolveAction(actionId);
    const effectiveMaxOutputTokens =
      typeof action.maxOutputTokens === "number" ? action.maxOutputTokens : defaultMaxOutputTokens;

    console.log(
      `[improve:start] requestId=${requestId} ip=${req.ip} selectedChars=${selectedText.length} actionId=${action.id}`
    );

    if (!selectedText) {
      console.warn(`[improve:invalid] requestId=${requestId} reason=missing_selected_text`);
      return res.status(400).json({ error: "Selected text is required." });
    }

    if (selectedText.length > maxChars) {
      console.warn(
        `[improve:invalid] requestId=${requestId} reason=selection_too_long selectedChars=${selectedText.length} maxChars=${maxChars}`
      );
      return res.status(400).json({
        error: `Selection is too long. Max ${maxChars} characters.`
      });
    }

    const finalPrompt = action.template.replace("{{selection}}", selectedText);

    const openAiStartedAt = Date.now();
    const response = await client.responses.create({
      model,
      input: finalPrompt,
      max_output_tokens: effectiveMaxOutputTokens
    });
    const openAiElapsedMs = Date.now() - openAiStartedAt;

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[improve:success] requestId=${requestId} actionId=${action.id} model=${model} maxOutputTokens=${effectiveMaxOutputTokens} resultChars=${(response.output_text || "").length} openAiElapsedMs=${openAiElapsedMs} elapsedMs=${elapsedMs}`
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
