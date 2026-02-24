import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

let googleMapsPromise: Promise<void> | null = null;
let isLoaded = false;
let cachedKey: string | null = null;

async function fetchApiKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  const { data, error } = await supabase.functions.invoke("get-maps-key");
  if (error || !data?.key) throw new Error("Failed to fetch Maps API key");
  cachedKey = data.key;
  return cachedKey;
}

function loadScript(apiKey: string): Promise<void> {
  if (isLoaded) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    if ((window as any).google?.maps) {
      isLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&callback=__initGoogleMaps`;
    script.async = true;
    script.defer = true;

    (window as any).__initGoogleMaps = () => {
      isLoaded = true;
      delete (window as any).__initGoogleMaps;
      resolve();
    };

    script.onerror = () => {
      googleMapsPromise = null;
      reject(new Error("Failed to load Google Maps"));
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

export function useGoogleMaps() {
  const [ready, setReady] = useState(isLoaded);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded) {
      setReady(true);
      return;
    }

    fetchApiKey()
      .then(loadScript)
      .then(() => setReady(true))
      .catch((err) => setError(err.message));
  }, []);

  return { ready, error };
}

function toRad(v: number) { return v * Math.PI / 180; }
function toDeg(v: number) { return v * 180 / Math.PI; }

function calcBearingBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function useCurrentLocation() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastRef = useRef<{ lat: number; lng: number; hdg: number } | null>(null);

  const processPosition = useCallback((pos: GeolocationPosition) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // Use GPS heading if available; fallback to bearing from last position
    let hdg = pos.coords.heading;
    if ((hdg == null || isNaN(hdg)) && lastRef.current) {
      const distMoved = Math.abs(lat - lastRef.current.lat) + Math.abs(lng - lastRef.current.lng);
      if (distMoved > 0.00001) {
        hdg = calcBearingBetween(lastRef.current.lat, lastRef.current.lng, lat, lng);
      } else {
        hdg = lastRef.current.hdg;
      }
    }
    const finalHdg = hdg ?? 0;
    lastRef.current = { lat, lng, hdg: finalHdg };
    setLocation({ lat, lng });
    setHeading(finalHdg);
  }, []);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocalização não suportada");
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      processPosition,
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  }, [processPosition]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      processPosition,
      (err) => setError(err.message),
      { enableHighAccuracy: true }
    );
  }, [processPosition]);

  return { location, heading, error, startWatching, stopWatching };
}
