import { useEffect, useRef, useState } from "react";
import { Download, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import type { GeneratedTake } from "../types/voice.ts";

interface WaveformPlayerProps {
  take: GeneratedTake | null;
  isGenerating: boolean;
  onDurationResolved?: (takeId: string, durationSec: number) => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function WaveformPlayer({
  take,
  isGenerating,
  onDurationResolved,
}: WaveformPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [peaks, setPeaks] = useState<number[]>([]);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(take?.durationSec ?? 0);
    setPeaks([]);

    if (!take?.audioUrl) return;

    let cancelled = false;
    const decodePeaks = async () => {
      try {
        const res = await fetch(take.audioUrl);
        const arrayBuf = await res.arrayBuffer();
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
        await ctx.close();
        if (cancelled) return;

        if (decoded.duration > 0) {
          setDuration(decoded.duration);
          onDurationResolved?.(take.id, decoded.duration);
        }

        const channel = decoded.getChannelData(0);
        const barCount = 96;
        const step = Math.max(1, Math.floor(channel.length / barCount));
        const computed: number[] = [];
        for (let i = 0; i < barCount; i++) {
          let maxAmp = 0;
          const start = i * step;
          const end = Math.min(channel.length, start + step);
          for (let j = start; j < end; j++) {
            const abs = Math.abs(channel[j]);
            if (abs > maxAmp) maxAmp = abs;
          }
          computed.push(Math.max(0.08, Math.min(1, maxAmp)));
        }
        setPeaks(computed);
      } catch {
        if (!cancelled) {
          setPeaks(Array.from({ length: 96 }, (_, i) => 0.2 + ((i * 17) % 50) / 100));
        }
      }
    };

    void decodePeaks();
    return () => {
      cancelled = true;
    };
  }, [take?.id, take?.audioUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, take?.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);

    const bars = peaks.length > 0 ? peaks : Array.from({ length: 96 }, () => 0.14);
    const barWidth = Math.max(2, (rect.width - (bars.length - 1) * 2) / bars.length);
    const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;

    bars.forEach((amp, idx) => {
      const x = idx * (barWidth + 2);
      const barHeight = Math.max(4, amp * (rect.height - 12));
      const y = (rect.height - barHeight) / 2;
      const barProgress = idx / bars.length;

      ctx.fillStyle = take && barProgress <= progressRatio ? "#2563EB" : "#CBD5E1";
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1.5);
      ctx.fill();
    });
  }, [peaks, currentTime, duration, take]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !take) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      await audio.play();
      setIsPlaying(true);
    }
  };

  const handleRestart = async () => {
    const audio = audioRef.current;
    if (!audio || !take) return;
    audio.currentTime = 0;
    setCurrentTime(0);
    await audio.play();
    setIsPlaying(true);
  };

  const handleCanvasSeek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas || !take || duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = ratio * duration;
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const handleDownload = () => {
    if (!take) return;
    const link = document.createElement("a");
    link.href = take.audioUrl;
    const slug = take.archetypeName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    link.download = `${slug}-${take.voiceName.toLowerCase()}.wav`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <section
      aria-label="Audio Preview"
      className="bg-white border border-slate-200 rounded-xl p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Master Audio Output
          </h2>
          {take ? (
            <p className="mt-1 text-xs text-slate-500">
              {take.archetypeName}
              <span aria-hidden="true" className="mx-1.5">·</span>
              {take.voiceName}
              <span aria-hidden="true" className="mx-1.5">·</span>
              {take.engine === "voice-design" ? "Voice Design" : "Fast Narrator"}
              <span aria-hidden="true" className="mx-1.5">·</span>
              24 kHz WAV
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              Select a male narrator preset and generate audio to preview and export.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Playback speed"
            className="flex items-center gap-0.5 p-1 bg-slate-100 rounded-lg"
          >
            {[0.85, 1, 1.15, 1.25].map((rate) => (
              <button
                key={rate}
                type="button"
                disabled={!take}
                onClick={() => setPlaybackRate(rate)}
                className={`px-2.5 py-1.5 text-xs font-mono tabular-nums rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  playbackRate === rate
                    ? "bg-white text-slate-900 shadow-xs font-medium"
                    : "text-slate-600 hover:text-slate-900 disabled:opacity-40"
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={!take}
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <Download className="w-4 h-4" />
            Download WAV
          </button>
        </div>
      </div>

      <div className="pt-5 flex items-center gap-4">
        <button
          type="button"
          disabled={!take || isGenerating}
          onClick={togglePlayback}
          aria-label={isPlaying ? "Pause narration" : "Play narration"}
          className="w-11 h-11 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center shrink-0 disabled:bg-slate-200 disabled:text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>

        <button
          type="button"
          disabled={!take || isGenerating}
          onClick={handleRestart}
          aria-label="Restart from beginning"
          className="w-10 h-10 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center shrink-0 disabled:opacity-40 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          {isGenerating ? (
            <div className="h-14 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center gap-2 text-sm text-slate-600">
              <Volume2 className="w-4 h-4 text-blue-600" />
              <span>Synthesizing studio WAV narration...</span>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              onClick={handleCanvasSeek}
              aria-label="Audio waveform scrub bar"
              className={`w-full h-14 block ${take ? "cursor-pointer" : "opacity-60"}`}
            />
          )}
        </div>

        <div className="text-right font-mono tabular-nums text-xs text-slate-600 shrink-0 min-w-[84px]">
          <span className="text-slate-900 font-medium">{formatTime(currentTime)}</span>
          <span className="mx-1 text-slate-400">/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {take && (
        <audio
          ref={audioRef}
          src={take.audioUrl}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) {
              setDuration(d);
              onDurationResolved?.(take.id, d);
            }
          }}
          onEnded={() => setIsPlaying(false)}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          className="hidden"
        />
      )}
    </section>
  );
}
