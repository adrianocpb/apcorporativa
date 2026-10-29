"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ProgressBar } from "@/components/ui/feedback";
import { toast } from "@/components/ui/toaster";

const SEND_EVERY_SECONDS = 10;

/**
 * Player com registro de progresso. Envia ao servidor os trechos assistidos de forma
 * contínua (sem pulos); o servidor valida contra o tempo real e decide a conclusão.
 * Retoma do ponto salvo.
 */
export function TrackedVideoPlayer({
  src,
  title,
  trackId,
  itemId,
  startAt,
  initialCoverage,
  completed: initiallyCompleted,
  threshold,
}: {
  src: string;
  title: string;
  trackId: string;
  itemId: string;
  startAt: number;
  initialCoverage: number;
  completed: boolean;
  threshold: number;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const segmentStart = useRef<number | null>(null);
  const lastTime = useRef(0);
  const [coverage, setCoverage] = useState(initialCoverage);
  const [completed, setCompleted] = useState(initiallyCompleted);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const payload = (from: number, to: number) =>
      JSON.stringify({ trackId, itemId, from, to, position: video.currentTime, duration: video.duration || 0 });

    async function send(from: number | null, to: number) {
      if (from === null || !(to > from)) return;
      try {
        const res = await fetch("/api/progresso/video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload(from, to),
          keepalive: true,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { coverage: number; completed: boolean };
        setCoverage(data.coverage);
        if (data.completed) {
          setCompleted((was) => {
            if (!was) {
              toast("Vídeo concluído!");
              router.refresh();
            }
            return true;
          });
        }
      } catch {
        // Falha de rede: o próximo sinal reenvia a partir do mesmo ponto.
      }
    }

    function flush() {
      const start = segmentStart.current;
      segmentStart.current = video!.paused ? null : video!.currentTime;
      void send(start, lastTime.current);
    }

    const onLoaded = () => {
      if (startAt > 0 && startAt < video.duration - 3) video.currentTime = startAt;
      lastTime.current = video.currentTime;
    };
    const onPlay = () => {
      segmentStart.current = video.currentTime;
      lastTime.current = video.currentTime;
    };
    const onTimeUpdate = () => {
      if (video.seeking) return;
      lastTime.current = video.currentTime;
      const start = segmentStart.current;
      if (start !== null && video.currentTime - start >= SEND_EVERY_SECONDS) flush();
    };
    const onSeeking = () => {
      // Fecha o trecho contínuo antes do pulo; o novo trecho começa após o pulo.
      const start = segmentStart.current;
      segmentStart.current = null;
      void send(start, lastTime.current);
    };
    const onSeeked = () => {
      lastTime.current = video.currentTime;
      if (!video.paused) segmentStart.current = video.currentTime;
    };
    const onPause = () => flush();
    const onLeave = () => {
      const start = segmentStart.current;
      if (start !== null && lastTime.current > start) {
        navigator.sendBeacon?.(
          "/api/progresso/video",
          // text/plain: tipo aceito por sendBeacon sem pré-verificação CORS.
          new Blob([payload(start, lastTime.current)], { type: "text/plain;charset=UTF-8" }),
        );
      }
    };

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("play", onPlay);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onPause);
    window.addEventListener("pagehide", onLeave);
    if (video.readyState >= 1) onLoaded();
    return () => {
      onLeave();
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onPause);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [trackId, itemId, startAt, router]);

  return (
    <div className="flex flex-col gap-3">
      <video
        ref={videoRef}
        controls
        preload="metadata"
        src={src}
        className="aspect-video w-full rounded-md bg-black"
        aria-label={title}
      >
        Seu navegador não reproduz este vídeo.
      </video>
      {completed ? (
        <p className="text-small text-success-text">Vídeo concluído. Você pode revê-lo quando quiser.</p>
      ) : (
        <div className="flex flex-col gap-1">
          <ProgressBar value={coverage} label="Quanto do vídeo foi assistido" />
          <p className="text-small text-ink-muted">
            Assista a pelo menos {threshold}% do vídeo para concluir. Trechos pulados não contam; seu ponto é salvo
            automaticamente.
          </p>
        </div>
      )}
    </div>
  );
}
