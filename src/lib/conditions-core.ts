/**
 * Pure helpers for the two extra public, keyless services the app consults:
 *
 * - **Open-Meteo** (https://open-meteo.com) — current weather + today's
 *   forecast, no key, no registration (listed in public-apis/public-apis).
 * - **Wikipedia** (`es.wikipedia.org` geosearch) — notable places around a
 *   coordinate, with a short extract. No key, no registration.
 *
 * Like `geo-core.ts`: no fetch, no DOM. URLs are built and payloads parsed here
 * so the server transport (`conditions.functions.ts`) and the browser fallback
 * (`conditions-direct.ts`) hit identical endpoints and return identical shapes.
 */

/** Shared result envelope and point type (same shapes as `geo-core.ts`). */
export type Ok<T> = { ok: true; data: T } | { ok: false; error: string };

export type Point = { lat: number; lon: number };

export type WeatherNow = {
  tempC: number;
  feelsC: number;
  /** WMO weather interpretation code (0 = clear sky, 61 = rain…). */
  code: number;
  isDay: boolean;
  precipMm: number;
  /** Today's range and rain chance, for the "¿salimos?" hint. */
  tMinC: number;
  tMaxC: number;
  rainChancePct: number;
  windKmh: number;
};

export type WikiHit = {
  title: string;
  extract: string;
  url: string;
};

export type WikiContext = {
  hits: WikiHit[];
};

/** Short Spanish label for a WMO weather code. */
export function weatherLabel(code: number): string {
  if (code === 0) return "Despejado";
  if (code <= 2) return "Poco nublado";
  if (code === 3) return "Nublado";
  if (code === 45 || code === 48) return "Niebla";
  if (code >= 51 && code <= 57) return "Llovizna";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "Lluvia";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "Nieve";
  if (code >= 95) return "Tormenta";
  return "Variable";
}

/** One-glance emoji for the weather chip (decorative; the label carries meaning). */
export function weatherEmoji(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? "☀️" : "🌙";
  if (code <= 2) return isDay ? "🌤️" : "☁️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 67) return "🌦️";
  if (code >= 71 && code <= 86) return "🌨️";
  if (code >= 95) return "⛈️";
  return "🌥️";
}

/**
 * Suggestion that turns a forecast into a decision: walk to dinner or take the
 * car, umbrella or sunglasses. Purely advisory text, never a warning.
 */
export function weatherAdvice(weather: WeatherNow): string {
  if (weather.rainChancePct >= 55 || weather.precipMm > 0.4) {
    return "Probable lluvia: lleva paraguas o ve en auto";
  }
  if (weather.code >= 95) return "Con tormenta, mejor un plan cerca";
  if (weather.tMaxC >= 32) return "Calor: busca terraza con sombra";
  if (weather.feelsC <= 12) return "Fresquito: ideal un lugar calientito";
  if (weather.windKmh >= 35) return "Much viento en la calle: camina con calma";
  return "Buen momento para salir a comer";
}

export function openMeteoUrl(point: { lat: number; lon: number }): string {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", point.lat.toFixed(4));
  url.searchParams.set("longitude", point.lon.toFixed(4));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,weather_code,is_day,precipitation,wind_speed_10m",
  );
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
  );
  url.searchParams.set("wind_speed_unit", "kmh");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("timezone", "auto");
  return url.toString();
}

type OpenMeteoPayload = {
  current?: Record<string, number>;
  daily?: Record<string, Array<number | null>>;
};

/** Open-Meteo payload → WeatherNow, or null when the reply is unusable. */
export function weatherFromOpenMeteo(payload: unknown): WeatherNow | null {
  const data = (payload ?? {}) as OpenMeteoPayload;
  const current = data.current ?? {};
  const daily = data.daily ?? {};
  const tempC = current.temperature_2m;
  if (typeof tempC !== "number") return null;
  const first = (values: Array<number | null> | undefined): number =>
    typeof values?.[0] === "number" ? (values[0] as number) : 0;
  return {
    tempC,
    feelsC: typeof current.apparent_temperature === "number" ? current.apparent_temperature : tempC,
    code: typeof current.weather_code === "number" ? current.weather_code : 0,
    isDay: current.is_day !== 0,
    precipMm: typeof current.precipitation === "number" ? current.precipitation : 0,
    tMinC: first(daily.temperature_2m_min),
    tMaxC: first(daily.temperature_2m_max),
    rainChancePct: first(daily.precipitation_probability_max),
    windKmh: typeof current.wind_speed_10m === "number" ? current.wind_speed_10m : 0,
  };
}

export function wikiGeosearchUrl(point: { lat: number; lon: number }, radiusM = 1000): string {
  const url = new URL("https://es.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("generator", "geosearch");
  url.searchParams.set("ggscoord", `${point.lat}|${point.lon}`);
  url.searchParams.set("ggsradius", String(Math.min(10000, Math.max(10, radiusM))));
  url.searchParams.set("ggslimit", "8");
  url.searchParams.set("ggsnamespace", "0");
  url.searchParams.set("prop", "extracts");
  url.searchParams.set("exintro", "1");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("exlimit", "max");
  url.searchParams.set("origin", "*");
  return url.toString();
}

type WikiPayload = {
  query?: {
    pages?: Array<{
      title?: string;
      extract?: string;
      index?: number;
    }>;
  };
};

/** First two sentences of an extract, for a one-glance card. */
export function firstSentences(text: string, maxSentences = 2, maxChars = 220): string {
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/);
  const out = sentences.slice(0, maxSentences).join(" ");
  return out.length > maxChars ? `${out.slice(0, maxChars - 1).trimEnd()}…` : out;
}

/** Wikipedia payload → up to `limit` context hits, closest/most relevant first. */
export function wikiFromPayload(payload: unknown, limit = 3): WikiContext {
  const pages = ((payload ?? {}) as WikiPayload).query?.pages ?? [];
  const hits = pages
    .filter((page) => page.title && page.extract)
    .sort((a, b) => (a.index ?? 99) - (b.index ?? 99))
    .slice(0, limit)
    .map((page) => ({
      title: page.title as string,
      extract: firstSentences(page.extract as string),
      url: `https://es.wikipedia.org/wiki/${encodeURIComponent((page.title as string).replace(/\s/g, "_"))}`,
    }));
  return { hits };
}
