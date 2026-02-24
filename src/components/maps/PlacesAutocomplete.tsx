/// <reference types="google.maps" />

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { MapPin, Navigation } from "lucide-react";

interface PlaceResult {
  address: string;
  lat: number;
  lng: number;
  addressComponents?: google.maps.GeocoderAddressComponent[];
}

interface PlacesAutocompleteProps {
  placeholder?: string;
  icon?: "origin" | "destination";
  onPlaceSelect: (place: PlaceResult) => void;
  value?: string;
  className?: string;
}

export function PlacesAutocomplete({
  placeholder = "Buscar endereço...",
  icon = "origin",
  onPlaceSelect,
  value,
  className = "",
}: PlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const { ready } = useGoogleMaps();
  const [inputValue, setInputValue] = useState(value || "");

  useEffect(() => {
    if (value !== undefined) setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (!ready || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "br" },
      fields: ["formatted_address", "geometry", "address_components"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (place.geometry?.location) {
        const result: PlaceResult = {
          address: place.formatted_address || "",
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          addressComponents: place.address_components,
        };
        setInputValue(result.address);
        onPlaceSelect(result);
      }
    });

    autocompleteRef.current = autocomplete;
  }, [ready, onPlaceSelect]);

  const IconComp = icon === "origin" ? Navigation : MapPin;
  const iconColor = icon === "origin" ? "text-success" : "text-destructive";

  return (
    <div className={`relative flex items-center gap-3 ${className}`}>
      <IconComp className={`h-5 w-5 shrink-0 ${iconColor}`} />
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={ready ? placeholder : "Carregando..."}
        disabled={!ready}
        className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 h-auto text-sm"
      />
    </div>
  );
}
