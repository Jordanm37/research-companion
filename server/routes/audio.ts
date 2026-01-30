import { Router, Request, Response } from "express";
import { AudioService, VoiceType, AudioOutputFormat } from "../services/audioService";

const router = Router();
const audioService = new AudioService();

/**
 * POST /api/audio/voice-chat
 * Voice chat: audio in, audio + transcript out
 */
router.post("/voice-chat", async (req: Request, res: Response) => {
  try {
    const { audio, voice = "alloy", outputFormat = "mp3" } = req.body;

    if (!audio) {
      return res.status(400).json({ error: "Audio data is required" });
    }

    const audioBuffer = Buffer.from(audio, "base64");
    const result = await audioService.voiceChat(
      audioBuffer,
      voice as VoiceType,
      outputFormat as "wav" | "mp3"
    );

    res.json({
      transcript: result.transcript,
      audio: result.audioResponse.toString("base64"),
    });
  } catch (error) {
    console.error("Voice chat error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Voice chat failed",
    });
  }
});

/**
 * POST /api/audio/voice-chat/stream
 * Streaming voice chat with SSE
 */
router.post("/voice-chat/stream", async (req: Request, res: Response) => {
  try {
    const { audio, voice = "alloy" } = req.body;

    if (!audio) {
      return res.status(400).json({ error: "Audio data is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const audioBuffer = Buffer.from(audio, "base64");
    const stream = await audioService.voiceChatStream(audioBuffer, voice as VoiceType);

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Streaming voice chat error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Streaming voice chat failed",
    });
  }
});

/**
 * POST /api/audio/tts
 * Text-to-speech
 */
router.post("/tts", async (req: Request, res: Response) => {
  try {
    const { text, voice = "alloy", format = "wav" } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const audioBuffer = await audioService.textToSpeech(
      text,
      voice as VoiceType,
      format as AudioOutputFormat
    );

    res.json({
      audio: audioBuffer.toString("base64"),
    });
  } catch (error) {
    console.error("TTS error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Text-to-speech failed",
    });
  }
});

/**
 * POST /api/audio/tts/stream
 * Streaming text-to-speech with SSE
 */
router.post("/tts/stream", async (req: Request, res: Response) => {
  try {
    const { text, voice = "alloy" } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await audioService.textToSpeechStream(text, voice as VoiceType);

    for await (const audioChunk of stream) {
      res.write(`data: ${JSON.stringify({ audio: audioChunk })}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Streaming TTS error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Streaming TTS failed",
    });
  }
});

/**
 * POST /api/audio/stt
 * Speech-to-text
 */
router.post("/stt", async (req: Request, res: Response) => {
  try {
    const { audio } = req.body;

    if (!audio) {
      return res.status(400).json({ error: "Audio data is required" });
    }

    const audioBuffer = Buffer.from(audio, "base64");
    const transcript = await audioService.speechToText(audioBuffer);

    res.json({ transcript });
  } catch (error) {
    console.error("STT error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Speech-to-text failed",
    });
  }
});

/**
 * POST /api/audio/stt/stream
 * Streaming speech-to-text with SSE
 */
router.post("/stt/stream", async (req: Request, res: Response) => {
  try {
    const { audio } = req.body;

    if (!audio) {
      return res.status(400).json({ error: "Audio data is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const audioBuffer = Buffer.from(audio, "base64");
    const stream = await audioService.speechToTextStream(audioBuffer);

    for await (const text of stream) {
      res.write(`data: ${JSON.stringify({ transcript: text })}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Streaming STT error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Streaming STT failed",
    });
  }
});

export default router;
