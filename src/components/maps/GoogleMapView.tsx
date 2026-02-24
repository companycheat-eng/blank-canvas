/// <reference types="google.maps" />

import { useEffect, useRef, useState, useCallback } from "react";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";

interface GoogleMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  onMapReady?: (map: google.maps.Map) => void;
}

export function GoogleMapView({ center, zoom = 14, className = "", onMapReady }: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const { ready, error } = useGoogleMaps();

  useEffect(() => {
    if (!ready || !mapRef.current || mapInstanceRef.current) return;

    const defaultCenter = center || { lat: -23.5505, lng: -46.6333 };

    const map = new google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom,
      disableDefaultUI: true,
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "simplified" }] },
      ],
    });

    mapInstanceRef.current = map;
    map.setOptions({ zoomControl: false });
    onMapReady?.(map);
  }, [ready]);

  useEffect(() => {
    if (mapInstanceRef.current && center) {
      mapInstanceRef.current.panTo(center);
    }
  }, [center]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-secondary ${className}`}>
        <p className="text-destructive text-sm">Erro ao carregar mapa: {error}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className={`flex items-center justify-center bg-secondary ${className}`}>
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Carregando mapa...</p>
        </div>
      </div>
    );
  }

  return <div ref={mapRef} className={className} />;
}

export function useMapMarkers(map: google.maps.Map | null) {
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());

  const addOrUpdateMarker = useCallback(
    (id: string, position: { lat: number; lng: number }, options?: Partial<google.maps.MarkerOptions>) => {
      if (!map) return;
      const existing = markersRef.current.get(id);
      if (existing) {
        existing.setPosition(position);
        if (options?.icon) existing.setIcon(options.icon as google.maps.Icon | google.maps.Symbol);
        return existing;
      }
      const marker = new google.maps.Marker({ map, position, ...options });
      markersRef.current.set(id, marker);
      return marker;
    },
    [map]
  );

  const removeMarker = useCallback((id: string) => {
    const marker = markersRef.current.get(id);
    if (marker) { marker.setMap(null); markersRef.current.delete(id); }
  }, []);

  const clearAll = useCallback(() => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current.clear();
  }, []);

  return { addOrUpdateMarker, removeMarker, clearAll };
}

export function useDirections(map: google.maps.Map | null) {
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string; distanceKm: number; durationMin: number } | null>(null);

  const renderRoute = useCallback(
    async (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) => {
      if (!map) return null;
      const service = new google.maps.DirectionsService();

      if (!rendererRef.current) {
        rendererRef.current = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: { strokeColor: "#2563EB", strokeWeight: 5, strokeOpacity: 0.8 },
        });
      }

      try {
        const result = await service.route({
          origin,
          destination,
          travelMode: google.maps.TravelMode.DRIVING,
        });
        rendererRef.current.setDirections(result);

        const leg = result.routes[0]?.legs[0];
        if (leg) {
          const info = {
            distance: leg.distance?.text || "",
            duration: leg.duration?.text || "",
            distanceKm: (leg.distance?.value || 0) / 1000,
            durationMin: Math.ceil((leg.duration?.value || 0) / 60),
          };
          setRouteInfo(info);
          return info;
        }
      } catch (err) {
        console.error("Directions error:", err);
      }
      return null;
    },
    [map]
  );

  const clearRoute = useCallback(() => {
    rendererRef.current?.setMap(null);
    rendererRef.current = null;
    setRouteInfo(null);
  }, []);

  return { renderRoute, clearRoute, routeInfo };
}
