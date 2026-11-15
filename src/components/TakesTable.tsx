import { useMemo, useState } from "react";
import { Download, Play, Search, Trash2 } from "lucide-react";
import type { GeneratedTake } from "../types/voice.ts";

interface TakesTableProps {
  takes: GeneratedTake[];
  activeTakeId: string | null;
  onSelectTake: (take: GeneratedTake) => void;
  onDeleteTake: (takeId: string) => void;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function TakesTable({
  takes,
  activeTakeId,
  onSelectTake,
  onDeleteTake,
}: TakesTableProps) {
  const [query, setQuery] = useState("");
  const [voiceFilter, setVoiceFilter] = useState<string>("all");

  const filteredTakes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return takes.filter((take) => {
      const matchesVoice = voiceFilter === "all" || take.voiceName === voiceFilter;
      const matchesQuery =
        !q ||
        take.script.toLowerCase().includes(q) ||
        take.archetypeName.toLowerCase().includes(q) ||
        take.voiceName.toLowerCase().includes(q);
      return matchesVoice && matchesQuery;
    });
  }, [takes, query, voiceFilter]);

  const handleDownload = (take: GeneratedTake) => {
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
      id="takes"
      aria-label="Session Take Library"
      className="bg-white border border-slate-200 rounded-xl"
    >
      <div className="p-6 pb-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Session Takes
          </h2>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {takes.length} {takes.length === 1 ? "take" : "takes"} recorded in this session
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter scripts or presets..."
              aria-label="Filter takes"
              className="pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:bg-white w-56"
            />
          </div>

          <div
            role="group"
            aria-label="Filter by base voice"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {["all", "Charon", "Fenrir", "Puck"].map((voice) => (
              <button
                key={voice}
                type="button"
                onClick={() => setVoiceFilter(voice)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  voiceFilter === voice
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {voice === "all" ? "All Voices" : voice}
              </button>
            ))}
          </div>
        </div>
      </div>

      {takes.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm font-medium text-slate-900">
            No generated takes yet
          </p>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Choose a male narrator preset on the left, enter or pick a sample script above, and generate your first royalty-free WAV track.
          </p>
        </div>
      ) : filteredTakes.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm font-medium text-slate-900">
            No matching takes
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Clear your search or switch the voice filter to view recorded takes.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-3 pl-6 pr-4">Preset &amp; Voice</th>
                <th className="py-3 px-4">Script Excerpt</th>
                <th className="py-3 px-4 text-right">Words</th>
                <th className="py-3 px-4 text-right">Duration</th>
                <th className="py-3 pl-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTakes.map((take) => {
                const isActive = take.id === activeTakeId;
                return (
                  <tr
                    key={take.id}
                    className={`border-b border-slate-100 last:border-b-0 transition-colors ${
                      isActive ? "bg-blue-50/60" : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="py-3.5 pl-6 pr-4 align-middle whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">
                        {take.archetypeName}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {take.voiceName}
                        <span aria-hidden="true" className="mx-1.5">·</span>
                        {take.createdAt}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 align-middle max-w-md">
                      <p className="text-sm text-slate-700 truncate">
                        {take.script}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 align-middle text-right font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                      {take.wordCount}
                    </td>
                    <td className="py-3.5 px-4 align-middle text-right font-mono tabular-nums text-xs text-slate-900 whitespace-nowrap">
                      {formatDuration(take.durationSec)}
                    </td>
                    <td className="py-3.5 pl-4 pr-6 align-middle text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectTake(take)}
                          aria-label={`Load take ${take.archetypeName}`}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                            isActive
                              ? "bg-[#2563EB] text-white"
                              : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                          }`}
                        >
                          <Play className="w-3.5 h-3.5" />
                          {isActive ? "Loaded" : "Load"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(take)}
                          aria-label="Download WAV"
                          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTake(take.id)}
                          aria-label="Delete take"
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
