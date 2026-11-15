export type VoiceName = "Charon" | "Fenrir" | "Puck" | "Kore" | "Zephyr";

export type EngineMode = "standard" | "voice-design";

export interface NarratorArchetype {
  id: string;
  name: string;
  subtitle: string;
  voiceName: VoiceName;
  recommendedEngine: EngineMode;
  pacing: "Slow & Measured" | "Conversational" | "Brisk Tutorial";
  tone: "Warm & Folksy" | "Clear Educator" | "Authoritative";
  stylePrompt: string;
}

export interface SampleScript {
  id: string;
  title: string;
  category: string;
  text: string;
}

export interface GeneratedTake {
  id: string;
  createdAt: string;
  archetypeName: string;
  voiceName: VoiceName;
  engine: EngineMode;
  stylePrompt: string;
  script: string;
  audioUrl: string;
  durationSec: number;
  wordCount: number;
}
