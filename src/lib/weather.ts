// Weather context is purely informational: a neutral fact shown alongside the
// logged record (e.g. "warmer than the recent average"). It is never used to
// infer or predict this patient's fluid status — see CLAUDE.md's hard rule
// against clinical-decision language. No API key is required: Open-Meteo's
// forecast endpoint is free and unauthenticated.

export class WeatherUnavailableError extends Error {}

export interface WeatherContext {
  currentTempC: number;
  recentAverageTempC: number;
  isWarmerThanUsual: boolean;
}

const WARM_THRESHOLD_C = 3;
const CACHE_TTL_MS = 30 * 60 * 1000;

let cache: { key: string; expires: number; context: WeatherContext } | null =
  null;

export function averageTemp(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function isWarmerThanUsual(
  currentTempC: number,
  recentDailyMeansC: number[],
  thresholdC = WARM_THRESHOLD_C
): boolean {
  if (recentDailyMeansC.length === 0) return false;
  return currentTempC - averageTemp(recentDailyMeansC) >= thresholdC;
}

export async function fetchWeatherContext(
  latitude: number,
  longitude: number
): Promise<WeatherContext> {
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  if (cache && cache.key === key && cache.expires > Date.now()) {
    return cache.context;
  }

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m&daily=temperature_2m_mean&past_days=6&forecast_days=1&timezone=auto`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new WeatherUnavailableError("Could not reach the weather service.");
  }
  if (!res.ok) {
    throw new WeatherUnavailableError(
      `Weather service returned an error (${res.status}).`
    );
  }

  const data = (await res.json()) as {
    current?: { temperature_2m?: number };
    daily?: { temperature_2m_mean?: number[] };
  };

  const currentTempC = data.current?.temperature_2m;
  const dailyMeans = data.daily?.temperature_2m_mean ?? [];
  if (currentTempC === undefined || dailyMeans.length < 2) {
    throw new WeatherUnavailableError("Weather data was incomplete.");
  }

  // `daily` covers the trailing `past_days` plus today (forecast_days=1);
  // the last entry is today, the rest form the recent baseline.
  const recentDailyMeans = dailyMeans.slice(0, -1);
  const recentAverageTempC = averageTemp(recentDailyMeans);

  const context: WeatherContext = {
    currentTempC,
    recentAverageTempC,
    isWarmerThanUsual: isWarmerThanUsual(currentTempC, recentDailyMeans),
  };

  cache = { key, expires: Date.now() + CACHE_TTL_MS, context };
  return context;
}
