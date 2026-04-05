import { useState, useRef, useCallback } from "react";
import { generateTTS } from "../api/media";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

function SpeakerIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M11 5L6 9H2v6h4l5 4V5z"
      />
    </svg>
  );
}

function LoadingIcon() {
  return (
    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

function PlayingIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 9v6m4-6v6"
      />
    </svg>
  );
}

export default function AudioPlayButton({ text, size = "sm" }) {
  const [state, setState] = useState("idle"); // idle | loading | playing
  const audioRef = useRef(null);
  const cachedUrlRef = useRef(null);

  const handleClick = useCallback(async () => {
    if (state === "playing") {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setState("idle");
      return;
    }

    if (state === "loading") return;

    try {
      setState("loading");

      let audioUrl = cachedUrlRef.current;
      if (!audioUrl) {
        const res = await generateTTS(text);
        // audio_url may be relative (/media/audio/...) or absolute
        const rawUrl = res.data.audio_url;
        audioUrl = rawUrl.startsWith("http")
          ? rawUrl
          : `${API_BASE_URL.replace(/\/api$/, "")}${rawUrl}`;
        cachedUrlRef.current = audioUrl;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.addEventListener("ended", () => setState("idle"));
      audio.addEventListener("error", () => setState("idle"));

      await audio.play();
      setState("playing");
    } catch {
      setState("idle");
    }
  }, [text, state]);

  const sizeClasses =
    size === "sm"
      ? "p-1.5 rounded-lg"
      : "p-2.5 rounded-xl";

  const colorClasses =
    state === "playing"
      ? "text-primary-700 bg-primary-100"
      : "text-gray-500 hover:text-primary-600 hover:bg-primary-50";

  return (
    <button
      onClick={handleClick}
      disabled={state === "loading"}
      className={`inline-flex items-center justify-center transition-colors ${sizeClasses} ${colorClasses} disabled:opacity-60`}
      title={state === "playing" ? "Stop" : "Listen"}
      aria-label={state === "playing" ? "Stop audio" : `Listen to "${text}"`}
    >
      {state === "loading" ? (
        <LoadingIcon />
      ) : state === "playing" ? (
        <PlayingIcon />
      ) : (
        <SpeakerIcon />
      )}
    </button>
  );
}
