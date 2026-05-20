import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testOpenAI() {
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: "Hello, how are you?",
  });

  console.log(response.output_text);
}

testOpenAI();