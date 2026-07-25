import { useEffect, useState } from "react";
import { fetchWeatherContext, type WeatherContext } from "../lib/weather";

export type WeatherState =
  | { status: "loading" }
  | { status: "ready"; context: WeatherContext }
  | { status: "unavailable" }
  | { status: "denied" }
  | { status: "error" };

export function useWeather(): WeatherState {
  const [state, setState] = useState<WeatherState>({ status: "loading" });

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "unavailable" });
      return;
    }

    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchWeatherContext(position.coords.latitude, position.coords.longitude)
          .then((context) => {
            if (!cancelled) setState({ status: "ready", context });
          })
          .catch(() => {
            if (!cancelled) setState({ status: "error" });
          });
      },
      (err) => {
        if (cancelled) return;
        setState({
          status: err.code === err.PERMISSION_DENIED ? "denied" : "error",
        });
      },
      { maximumAge: 30 * 60 * 1000, timeout: 10_000 }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
