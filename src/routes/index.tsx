import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { mountDinoLegend } from "@/game/legend.js";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cleanup = mountDinoLegend(el);
    return () => {
      cleanup();
    };
  }, []);
  return (
    <main className="game-shell">
      <div ref={ref} className="dino-root">
        <p className="boot-title">Dino Legend II</p>
        <p className="boot-sub">Loading the desert.</p>
      </div>
    </main>
  );
}
