import { useEffect, useState } from "react";
import { CloudSun, X } from "lucide-react";
import {
  weatherAdvice,
  weatherEmoji,
  weatherLabel,
  weatherNow,
  type WeatherNow,
} from "@/lib/conditions";

/**
 * One-line weather strip over the map: is it a good moment to go out?
 * Keyless public API (Open-Meteo), server-cached; failures collapse silently —
 * weather is garnish, not a dependency of the map.
 */
export function WeatherStrip({ lat, lon }: { lat: number; lon: number }) {
  const [weather, setWeather] = useState<WeatherNow | null>(null);
  const [failed, setFailed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let live = true;
    setFailed(false);
    void weatherNow({ lat, lon }).then((result) => {
      if (!live) return;
      if (result.ok) setWeather(result.data);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [lat, lon]);

  if (dismissed || failed) return null;

  return (
    <div
      className="rise mx-1 mt-2 flex items-center gap-2 border-t border-line px-1 pt-2 text-xs"
      role="status"
    >
      {weather ? (
        <>
          <span aria-hidden="true" className="text-base leading-none">
            {weatherEmoji(weather.code, weather.isDay)}
          </span>
          <span className="shrink-0 font-semibold">
            {Math.round(weather.tempC)}°
            <span className="sr-only"> Celsius, {weatherLabel(weather.code)}</span>
          </span>
          <span className="min-w-0 flex-1 truncate text-muted" title={weatherAdvice(weather)}>
            {weatherAdvice(weather)}
          </span>
          <a
            href={`https://open-meteo.com`}
            target="_blank"
            rel="noopener noreferrer"
            className="press hidden shrink-0 items-center gap-1 text-muted/70 hover:text-muted sm:inline-flex"
            aria-label="Clima por Open-Meteo (sitio externo)"
          >
            <CloudSun className="size-3.5" aria-hidden="true" />
            Open-Meteo
          </a>
        </>
      ) : (
        <>
          <span aria-hidden="true" className="text-base leading-none pulse-soft">
            🌤️
          </span>
          <span className="min-w-0 flex-1 truncate text-muted">Preguntando al cielo…</span>
        </>
      )}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Ocultar el clima"
        className="press grid size-7 shrink-0 place-items-center rounded-full text-muted hover:text-fg"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
