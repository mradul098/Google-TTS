import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Mic, SlidersHorizontal, Wand2 } from "lucide-react";
import { NARRATOR_ARCHETYPES, SAMPLE_SCRIPTS, VOICE_OPTIONS } from "./data/presets.ts";
import { WaveformPlayer } from "./components/WaveformPlayer.tsx";
import { TakesTable } from "./components/TakesTable.tsx";
import type { EngineMode, GeneratedTake, NarratorArchetype, VoiceName } from "./types/voice.ts";

function base64ToWavUrl(base64: string, mimeType: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType || "audio/wav" });
  return URL.createObjectURL(blob);
}

export default function App() {
  const defaultArchetype = NARRATOR_ARCHETYPES[0];

  const [selectedArchetypeId, setSelectedArchetypeId] = useState<string>(defaultArchetype.id);
  const [voiceName, setVoiceName] = useState<VoiceName>(defaultArchetype.voiceName);
  const [engine, setEngine] = useState<EngineMode>(defaultArchetype.recommendedEngine);
  const [stylePrompt, setStylePrompt] = useState<string>(defaultArchetype.stylePrompt);
  const [script, setScript] = useState<string>(SAMPLE_SCRIPTS[0].text);

  const [takes, setTakes] = useState<GeneratedTake[]>([]);
  const [activeTakeId, setActiveTakeId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeArchetype = useMemo<NarratorArchetype | undefined>(
    () => NARRATOR_ARCHETYPES.find((item) => item.id === selectedArchetypeId),
    [selectedArchetypeId]
  );

  const activeTake = useMemo<GeneratedTake | null>(
    () => takes.find((item) => item.id === activeTakeId) ?? null,
    [takes, activeTakeId]
  );

  const stats = useMemo(() => {
    const trimmed = script.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = script.length;
    const estSeconds = Math.round((words / 145) * 60);
    return { words, chars, estSeconds };
  }, [script]);

  useEffect(() => {
    return () => {
      takes.forEach((t) => URL.revokeObjectURL(t.audioUrl));
    };
  }, []);

  const handleSelectArchetype = (preset: NarratorArchetype) => {
    setSelectedArchetypeId(preset.id);
    setVoiceName(preset.voiceName);
    setEngine(preset.recommendedEngine);
    setStylePrompt(preset.stylePrompt);
    setErrorMessage(null);
  };

  const handleApplyDeliveryModifier = (
    kind: "pacing" | "texture",
    phrase: string
  ) => {
    setStylePrompt((prev) => {
      const cleaned = prev.trim();
      if (!cleaned) return phrase;
      if (cleaned.toLowerCase().includes(phrase.toLowerCase())) return cleaned;
      return `${cleaned.replace(/[.,;]+$/, "")}, ${phrase}.`;
    });
  };

  const handleGenerate = async () => {
    const trimmed = script.trim();
    if (!trimmed) {
      setErrorMessage("Enter a narration script before generating audio.");
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/tts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          voiceName,
          stylePrompt,
          engine,
        }),
      });

      const data = (await res.json()) as {
        audioBase64?: string;
        mimeType?: string;
        error?: string;
      };

      if (!res.ok || !data.audioBase64) {
        throw new Error(data.error || "Failed to generate narration audio.");
      }

      const audioUrl = base64ToWavUrl(data.audioBase64, data.mimeType || "audio/wav");
      const now = new Date();
      const timeLabel = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const newTake: GeneratedTake = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: timeLabel,
        archetypeName: activeArchetype?.name || "Custom Male Narrator",
        voiceName,
        engine,
        stylePrompt,
        script: trimmed,
        audioUrl,
        durationSec: stats.estSeconds,
        wordCount: stats.words,
      };

      setTakes((prev) => [newTake, ...prev]);
      setActiveTakeId(newTake.id);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred while synthesizing audio."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePolishScript = async () => {
    const trimmed = script.trim();
    if (!trimmed) {
      setErrorMessage("Enter rough text first so it can be formatted for spoken narration.");
      return;
    }

    setIsPolishing(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/tts/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          tone: activeArchetype?.name || "warm conversational male educator",
        }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !data.text) {
        throw new Error(data.error || "Unable to format script for speech.");
      }
      setScript(data.text);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to polish script for speech."
      );
    } finally {
      setIsPolishing(false);
    }
  };

  const handleDurationResolved = (takeId: string, durationSec: number) => {
    setTakes((prev) =>
      prev.map((item) =>
        item.id === takeId ? { ...item, durationSec } : item
      )
    );
  };

  const handleDeleteTake = (takeId: string) => {
    setTakes((prev) => {
      const target = prev.find((t) => t.id === takeId);
      if (target) URL.revokeObjectURL(target.audioUrl);
      const next = prev.filter((t) => t.id !== takeId);
      if (activeTakeId === takeId) {
        setActiveTakeId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const handleExportLatest = () => {
    const target = activeTake ?? takes[0];
    if (!target) {
      void handleGenerate();
      return;
    }
    const link = document.createElement("a");
    link.href = target.audioUrl;
    const slug = target.archetypeName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    link.download = `${slug}-${target.voiceName.toLowerCase()}.wav`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#studio"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-[var(--font-display)]"
          >
            Cadence Studio
          </a>

          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <a
              href="#studio"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Voice Studio
            </a>
            <a
              href="#presets"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Male Presets
            </a>
            <a
              href="#takes"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Take Library
            </a>
            <a
              href="#licensing"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Commercial Notes
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleExportLatest}
              disabled={isGenerating}
              className="px-4 py-2 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              {activeTake || takes.length > 0 ? "Export Active WAV" : "Generate Narration"}
            </button>
          </div>
        </div>
      </header>

      <main id="studio" className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 [text-wrap:balance]">
              Male Educator &amp; Narrator Voice Studio
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
              Audition warm, conversational male narrator styles tailored for lessons, documentaries, and product walkthroughs—exported directly as uncompressed 24 kHz WAV audio.
            </p>
          </div>

          <div className="text-xs text-slate-500 font-mono tabular-nums">
            <span>24 kHz Mono WAV</span>
            <span aria-hidden="true" className="mx-2">·</span>
            <span>No Per-Voice Royalties</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
          <aside
            id="presets"
            aria-label="Voice and Delivery Controls"
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-6"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                  Synthesis Engine
                </h2>
              </div>
              <div
                role="group"
                aria-label="TTS model mode"
                className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg"
              >
                <button
                  type="button"
                  onClick={() => setEngine("voice-design")}
                  className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    engine === "voice-design"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Voice Design
                </button>
                <button
                  type="button"
                  onClick={() => setEngine("standard")}
                  className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    engine === "standard"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Fast Narrator
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                {engine === "voice-design"
                  ? "Voice Design follows detailed persona and cadence direction."
                  : "Fast Narrator optimizes for rapid, consistent lesson reads."}
              </p>
            </div>

            <div className="pt-6 border-t border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">
                Male Narrator Archetypes
              </h2>
              <div className="space-y-2">
                {NARRATOR_ARCHETYPES.map((preset) => {
                  const selected = preset.id === selectedArchetypeId;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectArchetype(preset)}
                      className={`w-full text-left p-3.5 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                        selected
                          ? "border-[#2563EB] bg-blue-50/50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900">
                          {preset.name}
                        </span>
                        {selected && <Check className="w-4 h-4 text-[#2563EB] shrink-0" />}
                      </div>
                      <p className="mt-1 text-xs text-slate-600 leading-snug">
                        {preset.subtitle}
                      </p>
                      <p className="mt-1.5 text-[11px] text-slate-500 font-mono">
                        {preset.voiceName} · {preset.pacing}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-200">
              <label
                htmlFor="base-voice-select"
                className="block text-sm font-semibold text-slate-900 mb-2"
              >
                Base Register
              </label>
              <select
                id="base-voice-select"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value as VoiceName)}
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                {VOICE_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} — {v.character}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-6 border-t border-slate-200">
              <div className="flex items-center justify-between gap-2 mb-2">
                <label
                  htmlFor="style-direction"
                  className="text-sm font-semibold text-slate-900"
                >
                  Delivery Direction
                </label>
              </div>
              <textarea
                id="style-direction"
                rows={4}
                value={stylePrompt}
                onChange={(e) => setStylePrompt(e.target.value)}
                placeholder="Describe age, warmth, pacing, accent, and room tone..."
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:bg-white leading-relaxed resize-y"
              />
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {[
                  { label: "+ Folksy warmth", phrase: "subtle folksy warmth" },
                  { label: "+ Measured pauses", phrase: "measured pauses between concepts" },
                  { label: "+ Studio proximity", phrase: "close studio microphone presence" },
                ].map((mod) => (
                  <button
                    key={mod.label}
                    type="button"
                    onClick={() => handleApplyDeliveryModifier("texture", mod.phrase)}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    {mod.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="space-y-6 min-w-0">
            <section
              aria-label="Narration Script Editor"
              className="bg-white border border-slate-200 rounded-xl p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Narration Script
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Load an educational sample or paste your own lesson copy.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {SAMPLE_SCRIPTS.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => {
                        setScript(sample.text);
                        setErrorMessage(null);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      {sample.category}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <label htmlFor="narration-script" className="sr-only">
                  Narration script text
                </label>
                <textarea
                  id="narration-script"
                  rows={7}
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      void handleGenerate();
                    }
                  }}
                  placeholder="Write or paste your narration script here..."
                  className="w-full px-4 py-3 text-[15px] leading-relaxed bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:bg-white resize-y"
                />
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-xs text-slate-500 font-mono tabular-nums">
                  <span>{stats.words} words</span>
                  <span aria-hidden="true">·</span>
                  <span>{stats.chars} / 5,000 chars</span>
                  <span aria-hidden="true">·</span>
                  <span>~{stats.estSeconds}s read</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={isPolishing || isGenerating || !script.trim()}
                    onClick={handlePolishScript}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <Wand2 className="w-4 h-4" />
                    {isPolishing ? "Polishing..." : "Polish for Speech"}
                  </button>

                  <button
                    type="button"
                    disabled={isGenerating || !script.trim()}
                    onClick={handleGenerate}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                  >
                    <Mic className="w-4 h-4" />
                    {isGenerating ? "Generating WAV..." : "Generate Narration"}
                  </button>
                </div>
              </div>
            </section>

            <WaveformPlayer
              take={activeTake}
              isGenerating={isGenerating}
              onDurationResolved={handleDurationResolved}
            />

            <TakesTable
              takes={takes}
              activeTakeId={activeTakeId}
              onSelectTake={(take) => setActiveTakeId(take.id)}
              onDeleteTake={handleDeleteTake}
            />

            <section
              id="licensing"
              aria-label="Commercial Usage Reference"
              className="bg-white border border-slate-200 rounded-xl p-6"
            >
              <h2 className="text-base font-semibold text-slate-900">
                Commercial Rights &amp; Self-Hosted Alternative
              </h2>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-600 leading-relaxed">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Gemini TTS Output (This Studio)
                  </h3>
                  <p className="mt-1">
                    Audio generated here uses Gemini speech models under standard Gemini API terms—no per-voice-actor licensing fees or ElevenLabs voice-library restrictions.
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Offline Open-Weight Alternative (Kokoro-82M)
                  </h3>
                  <p className="mt-1">
                    If you ever need zero-cost local batch rendering offline, Kokoro-82M is Apache 2.0 licensed. Presets <span className="font-mono text-xs text-slate-800">am_michael</span> and <span className="font-mono text-xs text-slate-800">am_adam</span> match a warm male educator cadence.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
