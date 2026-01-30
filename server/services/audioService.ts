import OpenAI, { toFile } from "openai";
import { Buffer } from "node:buffer";
import { ensureCompatibleFormat } from "../utils/audio";

export type VoiceType = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
export type AudioOutputFormat = "wav" | "mp3" | "flac" | "opus" | "pcm16";

export interface VoiceChatResult {
  transcript: string;
  audioResponse: Buffer;
}

export interface AudioServiceConfig {
  apiKey?: string;
  baseURL?: string;
}

/**
 * Audio Service for voice chat, TTS, and STT using OpenAI's audio models.
 */
export class AudioService {
  private client: OpenAI;

  constructor(config: AudioServiceConfig = {}) {
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      baseURL: config.baseURL,
    });
  }

  /**
   * Voice Chat: User speaks, LLM responds with audio (audio-in, audio-out).
   * Automatically converts browser audio formats to WAV.
   */
  async voiceChat(
    audioBuffer: Buffer,
    voice: VoiceType = "alloy",
    outputFormat: "wav" | "mp3" = "mp3"
  ): Promise<VoiceChatResult> {
    const { buffer, format: inputFormat } = await ensureCompatibleFormat(audioBuffer);
    const audioBase64 = buffer.toString("base64");

    const response = await this.client.chat.completions.create({
      model: "gpt-4o-audio-preview",
      modalities: ["text", "audio"],
      audio: { voice, format: outputFormat },
      messages: [{
        role: "user",
        content: [
          { type: "input_audio", input_audio: { data: audioBase64, format: inputFormat } },
        ],
      }],
    });

    const message = response.choices[0]?.message as any;
    const transcript = message?.audio?.transcript || message?.content || "";
    const audioData = message?.audio?.data ?? "";

    return {
      transcript,
      audioResponse: Buffer.from(audioData, "base64"),
    };
  }

  /**
   * Streaming Voice Chat: For real-time audio responses.
   * Note: Streaming only supports pcm16 output format.
   */
  async voiceChatStream(
    audioBuffer: Buffer,
    voice: VoiceType = "alloy"
  ): Promise<AsyncIterable<{ type: "transcript" | "audio"; data: string }>> {
    const { buffer, format: inputFormat } = await ensureCompatibleFormat(audioBuffer);
    const audioBase64 = buffer.toString("base64");

    const stream = await this.client.chat.completions.create({
      model: "gpt-4o-audio-preview",
      modalities: ["text", "audio"],
      audio: { voice, format: "pcm16" },
      messages: [{
        role: "user",
        content: [
          { type: "input_audio", input_audio: { data: audioBase64, format: inputFormat } },
        ],
      }],
      stream: true,
    });

    return (async function* () {
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta as any;
        if (!delta) continue;
        if (delta?.audio?.transcript) {
          yield { type: "transcript" as const, data: delta.audio.transcript };
        }
        if (delta?.audio?.data) {
          yield { type: "audio" as const, data: delta.audio.data };
        }
      }
    })();
  }

  /**
   * Text-to-Speech: Converts text to speech verbatim.
   */
  async textToSpeech(
    text: string,
    voice: VoiceType = "alloy",
    format: AudioOutputFormat = "wav"
  ): Promise<Buffer> {
    const response = await this.client.chat.completions.create({
      model: "gpt-4o-audio-preview",
      modalities: ["text", "audio"],
      audio: { voice, format },
      messages: [
        { role: "system", content: "You are an assistant that performs text-to-speech." },
        { role: "user", content: `Repeat the following text verbatim: ${text}` },
      ],
    });

    const audioData = (response.choices[0]?.message as any)?.audio?.data ?? "";
    return Buffer.from(audioData, "base64");
  }

  /**
   * Streaming Text-to-Speech: Converts text to speech with real-time streaming.
   * Note: Streaming only supports pcm16 output format.
   */
  async textToSpeechStream(
    text: string,
    voice: VoiceType = "alloy"
  ): Promise<AsyncIterable<string>> {
    const stream = await this.client.chat.completions.create({
      model: "gpt-4o-audio-preview",
      modalities: ["text", "audio"],
      audio: { voice, format: "pcm16" },
      messages: [
        { role: "system", content: "You are an assistant that performs text-to-speech." },
        { role: "user", content: `Repeat the following text verbatim: ${text}` },
      ],
      stream: true,
    });

    return (async function* () {
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta as any;
        if (!delta) continue;
        if (delta?.audio?.data) {
          yield delta.audio.data;
        }
      }
    })();
  }

  /**
   * Speech-to-Text: Transcribes audio using dedicated transcription model.
   */
  async speechToText(audioBuffer: Buffer): Promise<string> {
    const { buffer, format } = await ensureCompatibleFormat(audioBuffer);
    const file = await toFile(buffer, `audio.${format}`);

    const response = await this.client.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });

    return response.text;
  }

  /**
   * Streaming Speech-to-Text: Transcribes audio with real-time streaming.
   */
  async speechToTextStream(audioBuffer: Buffer): Promise<AsyncIterable<string>> {
    const { buffer, format } = await ensureCompatibleFormat(audioBuffer);
    const file = await toFile(buffer, `audio.${format}`);

    const stream = await this.client.audio.transcriptions.create({
      file,
      model: "whisper-1",
      // Note: streaming transcription may not be available on all models
    } as any);

    // Handle both streaming and non-streaming responses
    if (typeof (stream as any)[Symbol.asyncIterator] === "function") {
      return (async function* () {
        for await (const event of stream as any) {
          if (event.type === "transcript.text.delta") {
            yield event.delta;
          }
        }
      })();
    }

    // Fallback: yield full text at once if streaming not supported
    return (async function* () {
      yield (stream as any).text;
    })();
  }
}

// Default instance using environment variables
export const audioService = new AudioService();
