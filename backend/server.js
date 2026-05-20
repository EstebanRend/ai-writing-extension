import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const maxChars = Number(process.env.MAX_SELECTION_CHARS || 4000);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "ai-writing-backend" });
});

app.post("/api/improve", async (req, res) => {
  try {
    const selectedText = String(req.body?.selectedText || "").trim();
    const promptTemplate = String(req.body?.prompt || "").trim();

    if (!selectedText) {
      return res.status(400).json({ error: "Selected text is required." });
    }

    if (selectedText.length > maxChars) {
      return res.status(400).json({
        error: `Selection is too long. Max ${maxChars} characters.`
      });
    }

    const prompt =
      promptTemplate ||
      "You are a professional writing assistant. Improve clarity, grammar, and flow while preserving the original meaning.\n\nText:\n{{selection}}";
    const finalPrompt = prompt.replace("{{selection}}", selectedText);

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: finalPrompt
    });

    return res.json({
      result: response.output_text || ""
    });
  } catch (error) {
    console.error("AI request failed:", error);
    return res.status(500).json({ error: "AI request failed." });
  }
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
