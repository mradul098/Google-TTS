import type { NarratorArchetype, SampleScript, VoiceName } from "../types/voice.ts";

export const VOICE_OPTIONS: Array<{
  id: VoiceName;
  label: string;
  character: string;
}> = [
  {
    id: "Charon",
    label: "Charon",
    character: "Grounded mid-low male register, balanced warmth",
  },
  {
    id: "Fenrir",
    label: "Fenrir",
    character: "Rich, weathered male baritone with chest resonance",
  },
  {
    id: "Puck",
    label: "Puck",
    character: "Lively, articulate male register for dynamic pacing",
  },
  {
    id: "Kore",
    label: "Kore",
    character: "Clear, crisp neutral voice for clean studio reads",
  },
  {
    id: "Zephyr",
    label: "Zephyr",
    character: "Bright, approachable conversational delivery",
  },
];

export const NARRATOR_ARCHETYPES: NarratorArchetype[] = [
  {
    id: "jesse-educator",
    name: "Jesse-Style Warm Educator",
    subtitle: "Conversational American male storyteller & teacher",
    voiceName: "Charon",
    recommendedEngine: "voice-design",
    pacing: "Conversational",
    tone: "Warm & Folksy",
    stylePrompt:
      "Warm, grounded American male educator in his late 30s, conversational storyteller cadence, subtle folksy texture, clear articulation, gentle pauses between key ideas.",
  },
  {
    id: "fireside-narrator",
    name: "Fireside Storyteller",
    subtitle: "Rich, unhurried male voice for history and documentaries",
    voiceName: "Fenrir",
    recommendedEngine: "voice-design",
    pacing: "Slow & Measured",
    tone: "Warm & Folksy",
    stylePrompt:
      "Deep, weathered, folksy American male narrator, relaxed campfire storytelling rhythm, rich chest resonance, thoughtful pauses.",
  },
  {
    id: "course-instructor",
    name: "Clear Course Instructor",
    subtitle: "Crisp, engaging pacing for lessons and video tutorials",
    voiceName: "Puck",
    recommendedEngine: "standard",
    pacing: "Brisk Tutorial",
    tone: "Clear Educator",
    stylePrompt:
      "Approachable, articulate male tutorial instructor, crisp diction, upbeat clarity, steady instructional cadence.",
  },
  {
    id: "documentary-host",
    name: "Documentary Host",
    subtitle: "Measured gravitas for explainers and science essays",
    voiceName: "Charon",
    recommendedEngine: "standard",
    pacing: "Slow & Measured",
    tone: "Authoritative",
    stylePrompt:
      "Calm, authoritative male documentary host, clean studio microphone proximity, measured pacing, understated gravitas.",
  },
];

export const SAMPLE_SCRIPTS: SampleScript[] = [
  {
    id: "science-explainer",
    title: "Why Bridges Hum",
    category: "Science Explainer",
    text: "Think about the last time you walked across a long suspension bridge on a windy afternoon. Even when the deck feels completely still under your boots, the steel cables overhead are quietly negotiating with the air. Every gust sheds tiny, alternating swirls of pressure—what engineers call vortex shedding—and if those swirls match the natural rhythm of the structure, a quiet hum turns into visible motion.",
  },
  {
    id: "history-story",
    title: "The First Transatlantic Cable",
    category: "Historical Story",
    text: "In the summer of 1858, sending a message from London to New York still meant putting paper on a steamship and waiting nearly two weeks for an answer. Yet two converted warships were quietly unspooling two thousand miles of gutta-percha insulated copper wire across the floor of the North Atlantic—betting everything on a single fragile thread.",
  },
  {
    id: "course-lesson",
    title: "Module 1: Active Recall",
    category: "Course Intro",
    text: "Welcome back. Before we dive into today's lesson, pause for five seconds and try to explain yesterday's concept out loud without checking your notes. That small moment of friction isn't a sign that you forgot—it is the exact mechanism your brain uses to lock ideas into long-term memory.",
  },
];
