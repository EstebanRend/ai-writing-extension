import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const maxChars = Number(process.env.MAX_SELECTION_CHARS || 4000);
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

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
    const selectedText = String(req.body?.selectedText || "").trim();
    const promptTemplate = String(req.body?.prompt || "").trim();

    console.log(
      `[improve:start] requestId=${requestId} ip=${req.ip} selectedChars=${selectedText.length} hasPromptTemplate=${Boolean(
        promptTemplate
      )}`
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

    const prompt =
      promptTemplate ||
      "You are a professional writing assistant. Improve clarity, grammar, and flow while preserving the original meaning.\n\nText:\n{{selection}}";
    const finalPrompt = prompt.replace("{{selection}}", selectedText);

    const response = await client.responses.create({
      model,
      input: finalPrompt
    });

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[improve:success] requestId=${requestId} model=${model} resultChars=${(response.output_text || "").length} elapsedMs=${elapsedMs}`
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
