const OpenAI = require("openai");

let client;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const error = new Error("OpenAI is not configured.");
    error.code = "OPENAI_NOT_CONFIGURED";
    throw error;
  }

  if (!client) {
    client = new OpenAI({
      apiKey,
      timeout: 20000,
      maxRetries: 1
    });
  }
  return client;
}

module.exports = getOpenAIClient;
