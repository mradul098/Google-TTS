import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: "v1beta",
    httpOptions: {
      apiVersion: "v1beta",
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function getErrorStatusAndMessage(err: unknown): { status: number; message: string } {
  const fallback = "Unable to complete request. Please try again.";
  if (!err || typeof err !== "object") {
    return { status: 500, message: fallback };
  }
  const errorObj = err as { status?: number; message?: string };
  let msg = typeof errorObj.message === "string" && errorObj.message.trim()
    ? errorObj.message
    : fallback;
  let status = typeof errorObj.status === "number" && errorObj.status >= 400 && errorObj.status < 600
    ? errorObj.status
    : 500;

  if (msg.startsWith("{")) {
    try {
      const parsed = JSON.parse(msg) as { error?: { code?: number; message?: string } };
      if (parsed.error?.message) {
        msg = parsed.error.message;
      }
      if (typeof parsed.error?.code === "number" && parsed.error.code >= 400 && parsed.error.code < 600) {
        status = parsed.error.code;
      }
    } catch {
      // Keep original message if not valid JSON
    }
  }

  if (msg.includes("API_KEY_INVALID") || msg.includes("PERMISSION_DENIED") || status === 403) {
    return {
      status: 403,
      message: "Gemini API key is missing or invalid. Check your key in Settings > Secrets.",
    };
  }
  if (msg.includes("RESOURCE_EXHAUSTED") || status === 429) {
    return {
      status: 429,
      message: "Rate limit or quota reached. Please wait a moment and retry.",
    };
  }
  return { status, message: msg };
}

interface GenerateTtsBody {
  text?: string;
  voiceName?: string;
  stylePrompt?: string;
  engine?: "standard" | "voice-design";
}

interface PolishScriptBody {
  text?: string;
  tone?: string;
}

const ALLOWED_VOICES = new Set(["Charon", "Fenrir", "Puck", "Kore", "Zephyr"]);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.post("/api/tts/generate", async (req, res) => {
    try {
      const body = (req.body || {}) as GenerateTtsBody;
      const text = typeof body.text === "string" ? body.text.trim() : "";
      const voiceName = typeof body.voiceName === "string" && ALLOWED_VOICES.has(body.voiceName)
        ? body.voiceName
        : "Charon";
      const stylePrompt = typeof body.stylePrompt === "string" ? body.stylePrompt.trim() : "";
      const model = body.engine === "voice-design"
        ? "gemini-3.8-flash-tts"
        : "gemini-3.8-flash-lite-tts";

      if (!text) {
        res.status(400).json({ error: "Please enter a narration script before generating audio." });
        return;
      }
      if (text.length > 5000) {
        res.status(400).json({ error: "Script must be 5,000 characters or fewer per take." });
        return;
      }

      const ai = getAiClient();
      const userPart: { text: string; speechMetadata?: { style: string } } = { text };
      if (stylePrompt) {
        userPart.speechMetadata = { style: stylePrompt };
      }

      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [userPart],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const audioPart = parts.find((p) => p.inlineData?.data);
      const base64Audio = audioPart?.inlineData?.data;
      const mimeType = audioPart?.inlineData?.mimeType || "audio/wav";

      if (!base64Audio) {
        res.status(502).json({
          error: "No audio data was returned by the model. Try adjusting the script or voice style.",
        });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType,
        model,
        voiceName,
      });
    } catch (err) {
      const { status, message } = getErrorStatusAndMessage(err);
      res.status(status).json({ error: message });
    }
  });

  app.post("/api/tts/polish", async (req, res) => {
    try {
      const body = (req.body || {}) as PolishScriptBody;
      const text = typeof body.text === "string" ? body.text.trim() : "";
      const tone = typeof body.tone === "string" && body.tone.trim()
        ? body.tone.trim()
        : "warm, conversational male educator";

      if (!text) {
        res.status(400).json({ error: "Provide a script to format for spoken narration." });
        return;
      }
      if (text.length > 5000) {
        res.status(400).json({ error: "Script must be 5,000 characters or fewer." });
        return;
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: text,
        config: {
          systemInstruction:
            `You are a spoken-word script editor preparing text for a ${tone} narrator. ` +
            "Keep the exact meaning, facts, and core vocabulary, while lightly smoothing stiff written syntax into natural spoken phrasing with clean punctuation (commas, em-dashes, short sentences) so a narrator breathes naturally. " +
            "Return ONLY the revised narration script without quotes, stage directions, or commentary.",
        },
      });

      const polished = (response.text ?? "").trim();
      if (!polished) {
        res.status(502).json({ error: "Could not refine the script. Please try again." });
        return;
      }

      res.json({ text: polished });
    } catch (err) {
      const { status, message } = getErrorStatusAndMessage(err);
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
