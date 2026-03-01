import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, MapPin, Navigation, ChevronRight, Minus, Plus, ArrowLeft, Loader2, Check, X, DollarSign, Search, Car, Banknote, QrCode, Users } from "lucide-react";
import { StarRating } from "@/components/StarRating";
import { Switch } from "@/components/ui/switch";
import { ChatDrawer } from "@/components/chat/ChatDrawer";
import { ZoomableAvatar } from "@/components/ZoomableAvatar";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { GoogleMapView, useDirections, useMapMarkers } from "@/components/maps/GoogleMapView";
import { PlacesAutocomplete } from "@/components/maps/PlacesAutocomplete";
import { useCurrentLocation, useGoogleMaps } from "@/hooks/useGoogleMaps";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { titleCase } from "@/lib/utils";

interface Place {
  address: string;
  lat: number;
  lng: number;
}

interface Categoria {
  id: string;
  nome: string;
  icone: string;
}

interface ItemCatalogo {
  id: string;
  nome: string;
  icone: string | null;
  preco: number;
  categoria_id: string | null;
}

interface SelectedItem {
  item: ItemCatalogo;
  qtd: number;
}

type Step = "localizacao" | "destino" | "itens" | "resumo" | "aguardando";

const LOCATION_TIMEOUT = 8000; // 8 seconds before showing manual input

export default function ClienteMapa() {
  const { location } = useCurrentLocation();
  const { user } = useAuth();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [step, setStep] = useState<Step>("localizacao");
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [itens, setItens] = useState<ItemCatalogo[]>([]);
  const [selectedItens, setSelectedItens] = useState<SelectedItem[]>([]);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [bairroId, setBairroId] = useState<string | null>(null);
  const [bairroCenter, setBairroCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [corridaAtiva, setCorridaAtiva] = useState<any>(null);
  const [propostas, setPropostas] = useState<any[]>([]);
  const [gpsTimedOut, setGpsTimedOut] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState<"dinheiro" | "pix">("dinheiro");
  const [valorPorKm, setValorPorKm] = useState(3); // default R$3/km
  const [surgeMultiplier, setSurgeMultiplier] = useState(1);
  const [comAjudante, setComAjudante] = useState(false);
  const [precoAjudante, setPrecoAjudante] = useState(0);
  const { addOrUpdateMarker, removeMarker, clearAll } = useMapMarkers(map);
  const { renderRoute, clearRoute, routeInfo } = useDirections(map);
  const [onlineDriverIds, setOnlineDriverIds] = useState<string[]>([]);
  const prevDriverPositions = useRef<Record<string, { lat: number; lng: number }>>({});
  const [markerIcons, setMarkerIcons] = useState<Record<string, string>>({});
  const markerIconsRef = useRef<Record<string, string>>({});


  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // Load custom marker icons from config
  useEffect(() => {
    const loadMarkerIcons = async () => {
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token || apikey;
        const res = await fetch(
          `${baseUrl}/rest/v1/config_global?select=key,value&key=in.(marker_motorista,marker_origem,marker_destino,marker_cliente)`,
          { headers: { apikey, Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (Array.isArray(data)) {
          const icons: Record<string, string> = {};
          data.forEach((c: any) => {
            const url = typeof c.value === "string" ? c.value : c.value?.url;
            if (url) icons[c.key] = url;
          });
          markerIconsRef.current = icons;
          setMarkerIcons(icons);
        }
      } catch (err) {
        console.error("Erro ao carregar ícones de marcador:", err);
      }
    };
    loadMarkerIcons();
  }, []);

  const customIconCache = useRef<Record<string, google.maps.Icon>>({});
  const rotatedIconCache = useRef<Record<string, google.maps.Icon>>({});
  const loadedImages = useRef<Record<string, HTMLImageElement>>({});

  // Preload marker images for Canvas rotation
  useEffect(() => {
    const icons = markerIconsRef.current;
    Object.entries(icons).forEach(([key, url]) => {
      if (!loadedImages.current[key]) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = url;
        img.onload = () => { loadedImages.current[key] = img; };
      }
    });
  }, [markerIcons]);

  const customIcon = (key: string, maxHeight = 40) => {
    const icons = markerIconsRef.current;
    if (!icons[key] || typeof google === "undefined") return undefined;
    if (customIconCache.current[key]) return customIconCache.current[key];

    const img = loadedImages.current[key];
    const w = img?.naturalWidth || maxHeight;
    const h = img?.naturalHeight || maxHeight;
    const ratio = w / h;
    const scaledH = maxHeight;
    const scaledW = Math.round(scaledH * ratio);

    const icon: google.maps.Icon = {
      url: icons[key],
      scaledSize: new google.maps.Size(scaledW, scaledH),
      anchor: new google.maps.Point(Math.round(scaledW / 2), Math.round(scaledH / 2)),
    };
    if (img?.naturalWidth && img.naturalWidth > 0) customIconCache.current[key] = icon;
    return icon;
  };

  // Generate a rotated icon via Canvas
  const getRotatedIcon = useCallback((key: string, rotation: number, maxHeight = 40): google.maps.Icon | undefined => {
    if (typeof google === "undefined") return undefined;
    const img = loadedImages.current[key];
    if (!img || !img.naturalWidth) return undefined;

    // Round rotation to nearest 5 degrees for caching
    const roundedRot = Math.round(rotation / 5) * 5;
    const cacheKey = `${key}_${roundedRot}`;
    if (rotatedIconCache.current[cacheKey]) return rotatedIconCache.current[cacheKey];

    const ratio = img.naturalWidth / img.naturalHeight;
    const scaledH = maxHeight;
    const scaledW = Math.round(scaledH * ratio);

    // Canvas size must fit the rotated image (use diagonal as safe size)
    const canvasSize = Math.ceil(Math.sqrt(scaledW * scaledW + scaledH * scaledH));
    const canvas = document.createElement("canvas");
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    ctx.translate(canvasSize / 2, canvasSize / 2);
    ctx.rotate((roundedRot * Math.PI) / 180);
    ctx.drawImage(img, -scaledW / 2, -scaledH / 2, scaledW, scaledH);

    const icon: google.maps.Icon = {
      url: canvas.toDataURL("image/png"),
      scaledSize: new google.maps.Size(canvasSize, canvasSize),
      anchor: new google.maps.Point(canvasSize / 2, canvasSize / 2),
    };
    rotatedIconCache.current[cacheKey] = icon;
    return icon;
  }, []);

  const getDefaultOriginIcon = () => ({ path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#22C55E", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 });
  const getDefaultDestIcon = (): google.maps.Icon => ({ url: "/markers/bandeira.png", scaledSize: new google.maps.Size(38, 50), anchor: new google.maps.Point(4, 50) });
  const getDefaultClientIcon = () => ({ path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: "#22C55E", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 });
  const getDefaultDriverIcon = (rotation = 0) => ({ path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 6, fillColor: "#2563EB", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2, rotation });

  const calcBearing = (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const toDeg = (r: number) => (r * 180) / Math.PI;
    const dLng = toRad(to.lng - from.lng);
    const y = Math.sin(dLng) * Math.cos(toRad(to.lat));
    const x = Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) - Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  };

  // Load client info and bairro coordinates
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const session = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
      const token = session.data.session?.access_token || apikey;
      const res = await fetch(
        `${baseUrl}/rest/v1/clientes?select=id,bairro_id,bairros(lat,lng)&user_id=eq.${user.id}&limit=1`,
        { headers: { apikey, Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data?.[0]) {
        setClienteId(data[0].id);
        setBairroId(data[0].bairro_id);
        if (data[0].bairros?.lat && data[0].bairros?.lng) {
          setBairroCenter({ lat: data[0].bairros.lat, lng: data[0].bairros.lng });
        }
      }
    };
    load();
  }, [user]);

  // Fetch pricing config (valor_por_km + multiplicador_horario)
  useEffect(() => {
    if (!bairroId) return;
    const loadPricing = async () => {
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token || apikey;
        const h = { apikey, Authorization: `Bearer ${token}` };

        // Fetch bairro config, fallback to global
        const [bairroRes, globalRes] = await Promise.all([
          fetch(`${baseUrl}/rest/v1/config_bairro?select=key,value&bairro_id=eq.${bairroId}&key=in.(valor_por_km,multiplicador_horario,ajudante_preco)`, { headers: h }),
          fetch(`${baseUrl}/rest/v1/config_global?select=key,value&key=in.(valor_por_km,ajudante_preco)`, { headers: h }),
        ]);

        const bairroConfigs = await bairroRes.json();
        const globalConfigs = await globalRes.json();

        // valor_por_km: bairro override > global > default 3
        const bairroVpk = (bairroConfigs || []).find((c: any) => c.key === "valor_por_km");
        const globalVpk = (globalConfigs || []).find((c: any) => c.key === "valor_por_km");
        const vpkVal = bairroVpk?.value?.valor ?? globalVpk?.value?.valor ?? 3;
        setValorPorKm(Number(vpkVal));

        // multiplicador_horario: check current time against faixas
        const surgeConfig = (bairroConfigs || []).find((c: any) => c.key === "multiplicador_horario");
        if (surgeConfig) {
          const faixas = surgeConfig.value?.faixas || (Array.isArray(surgeConfig.value) ? surgeConfig.value : []);
          const now = new Date();
          const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
          let mult = 1;
          for (const f of faixas) {
            if (f.inicio <= f.fim) {
              // Normal range (e.g. 18:00 - 22:00)
              if (currentTime >= f.inicio && currentTime < f.fim) mult = Math.max(mult, f.multiplicador);
            } else {
              // Overnight range (e.g. 22:00 - 06:00)
              if (currentTime >= f.inicio || currentTime < f.fim) mult = Math.max(mult, f.multiplicador);
            }
          }
          setSurgeMultiplier(mult);
        }

        // ajudante_preco: bairro override > global > 0
        const bairroAjud = (bairroConfigs || []).find((c: any) => c.key === "ajudante_preco");
        const globalAjud = (globalConfigs || []).find((c: any) => c.key === "ajudante_preco");
        const ajudVal = bairroAjud?.value?.valor ?? globalAjud?.value?.valor ?? 0;
        setPrecoAjudante(Number(ajudVal));
      } catch (err) {
        console.error("Erro ao carregar configuração de preço:", err);
      }
    };
    loadPricing();
  }, [bairroId]);

  // Check for existing active ride on mount
  useEffect(() => {
    if (!clienteId) return;
    const checkActive = async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || apikey;
      const res = await fetch(
        `${baseUrl}/rest/v1/corridas?select=*&cliente_id=eq.${clienteId}&status=in.(buscando,aceita,a_caminho,chegou,carregando,em_deslocamento)&order=created_at.desc&limit=1`,
        { headers: { apikey, Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data?.[0]) {
        const corrida = data[0];
        // If ride has a motorista, fetch their info including vehicle
        if (corrida.motorista_id && ["aceita", "a_caminho", "chegou", "carregando", "em_deslocamento"].includes(corrida.status)) {
          const mRes = await fetch(
            `${baseUrl}/rest/v1/motoristas?select=nome,foto_url,last_lat,last_lng,placa,tipo_veiculo,marca_veiculo,cor_veiculo,nota_referencia&id=eq.${corrida.motorista_id}&limit=1`,
            { headers: { apikey, Authorization: `Bearer ${token}` } }
          );
          const mData = await mRes.json();
          if (mData?.[0]) {
            corrida.motorista_nome = mData[0].nome;
            corrida.motorista_foto_url = mData[0].foto_url;
            corrida.motorista_placa = mData[0].placa;
            corrida.motorista_tipo_veiculo = mData[0].tipo_veiculo;
            corrida.motorista_marca_veiculo = mData[0].marca_veiculo;
            corrida.motorista_cor_veiculo = mData[0].cor_veiculo;
            corrida.motorista_nota = mData[0].nota_referencia;
          }
        }
        setCorridaAtiva(corrida);
        setStep("aguardando");
      }
    };
    checkActive();
  }, [clienteId]);

  // Render route based on ride phase:
  // Before coleta (aceita/a_caminho/chegou): motorista → origem
  // After coleta (em_deslocamento): origem → destino
  // buscando/contra_proposta: origem → destino (preview)
  const [lastMotoristaPos, setLastMotoristaPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!corridaAtiva || !map) return;
    const o = { lat: corridaAtiva.origem_lat, lng: corridaAtiva.origem_lng };
    const d = { lat: corridaAtiva.destino_lat, lng: corridaAtiva.destino_lng };

    // Always show origin marker during active ride (hide green dot instead)
    removeMarker("myLocation");
    addOrUpdateMarker("origin", o, {
      icon: customIcon("marker_origem") || getDefaultOriginIcon(),
    });

    // Destination marker (flag image)
    addOrUpdateMarker("destination", d, {
      icon: customIcon("marker_destino") || {
        url: "/markers/bandeira.png",
        scaledSize: new google.maps.Size(38, 50),
        anchor: new google.maps.Point(4, 50),
      },
    });

    const status = corridaAtiva.status;

    // Clear previous route before rendering new one to avoid stale state
    clearRoute();

    if (["em_deslocamento"].includes(status)) {
      // After pickup: route from origin to destination
      renderRoute(o, d);
    } else if (["aceita", "a_caminho", "chegou", "carregando"].includes(status) && lastMotoristaPos) {
      // Before pickup: route from motorista to origin
      renderRoute(lastMotoristaPos, o);
    } else if (["aceita", "a_caminho", "chegou", "carregando"].includes(status) && !lastMotoristaPos) {
      // Motorista accepted but position not yet available: show origin → destination
      renderRoute(o, d);
    } else {
      // Fallback (buscando, contra_proposta): origin → destination
      renderRoute(o, d);
    }
  }, [corridaAtiva?.id, corridaAtiva?.status, map, lastMotoristaPos]);

  // Auto-set origin from GPS with reverse geocoding (wait for Google Maps to be ready)
  const { ready: mapsReady } = useGoogleMaps();

  useEffect(() => {
    if (location && !origin && mapsReady) {
      const pos = { lat: location.lat, lng: location.lng };
      setGpsTimedOut(false);

      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: pos }, (results, status) => {
        const address =
          status === "OK" && results?.[0]
            ? results[0].formatted_address
            : "Sua localização atual";
        setOrigin({ address, lat: pos.lat, lng: pos.lng });
      });
    }
  }, [location, mapsReady]);

  // GPS timeout - show manual input after delay
  useEffect(() => {
    if (origin) return;
    const timer = setTimeout(() => {
      if (!origin) setGpsTimedOut(true);
    }, LOCATION_TIMEOUT);
    return () => clearTimeout(timer);
  }, [origin]);

  // Show client location marker only before destination is set and no active ride
  useEffect(() => {
    if (!location || !map) return;
    // Hide green dot once destination has been selected or there's an active ride
    if (destination || corridaAtiva) return;
    addOrUpdateMarker("myLocation", location, {
      icon: customIcon("marker_cliente") || getDefaultClientIcon(),
    });
  }, [location, map, addOrUpdateMarker, destination, corridaAtiva]);

  // Poll online drivers in bairro (before ride is accepted)
  useEffect(() => {
    if (!bairroId || !map) return;
    // Only show online drivers when not in an active ride with assigned motorista
    const hasAssignedMotorista = corridaAtiva?.motorista_id && 
      ["aceita", "a_caminho", "chegou", "carregando", "em_deslocamento"].includes(corridaAtiva?.status);
    
    if (hasAssignedMotorista) {
      // Clear all driver markers except the assigned one
      onlineDriverIds.forEach((id) => {
        if (id !== corridaAtiva.motorista_id) removeMarker(`driver-${id}`);
      });
      setOnlineDriverIds([]);
      return;
    }

    const poll = async () => {
      try {
        const session = await supabase.auth.getSession();
        const tk = session.data.session?.access_token || apikey;
        const res = await fetch(
          `${baseUrl}/functions/v1/drivers-location?bairro_id=${bairroId}`,
          { headers: { Authorization: `Bearer ${tk}`, apikey } }
        );
        const data = await res.json();
        if (!Array.isArray(data)) return;

        const newIds = data.map((d: any) => d.id);
        
        // Remove markers for drivers no longer online
        onlineDriverIds.forEach((oldId) => {
          if (!newIds.includes(oldId)) removeMarker(`driver-${oldId}`);
        });

        // Add/update markers for online drivers
        data.forEach((d: any) => {
          if (d.last_lat && d.last_lng) {
            const pos = { lat: d.last_lat, lng: d.last_lng };
            // Use heading from DB (sent by driver's GPS/bearing calculation); fallback to calcBearing
            let rotation: number = d.last_heading ?? null;
            if (rotation === null || rotation === undefined) {
              const prev = prevDriverPositions.current[d.id];
              rotation = (prev && (prev.lat !== pos.lat || prev.lng !== pos.lng))
                ? calcBearing(prev, pos) : 0;
            }
            prevDriverPositions.current[d.id] = pos;
            // Use custom marker_motorista icon if uploaded in admin, otherwise blue arrow
            const icons = markerIconsRef.current;
            let icon: google.maps.Icon | google.maps.Symbol;
            if (icons["marker_motorista"]) {
              const rotatedCustom = getRotatedIcon("marker_motorista", rotation, 40);
              icon = rotatedCustom || customIcon("marker_motorista", 40) || getDefaultDriverIcon(rotation);
            } else {
              icon = getDefaultDriverIcon(rotation);
            }
            addOrUpdateMarker(`driver-${d.id}`, pos, { icon });
          }
        });

        setOnlineDriverIds(newIds);
      } catch (err) {
        console.error("Erro ao buscar motoristas online:", err);
      }
    };

    // Dynamic interval: 5s during active ride (buscando), 15s when browsing
    const driverPollMs = corridaAtiva && ["buscando", "contra_proposta"].includes(corridaAtiva.status) ? 5000 : 15000;
    poll();
    const interval = setInterval(poll, driverPollMs);
    return () => clearInterval(interval);
  }, [bairroId, map, corridaAtiva?.motorista_id, corridaAtiva?.status, markerIcons]);

  // Smooth animated pan/zoom helper (frame-based interpolation)
  const animatePan = useCallback(
    (from: { lat: number; lng: number }, to: { lat: number; lng: number }, zoomFrom: number, zoomTo: number, frames = 60, callback?: () => void) => {
      if (!map) return;
      let step = 0;
      function panStep() {
        step++;
        const t = step / frames;
        const lat = from.lat + (to.lat - from.lat) * t;
        const lng = from.lng + (to.lng - from.lng) * t;
        const zoom = zoomFrom + (zoomTo - zoomFrom) * t;
        map!.setCenter({ lat, lng });
        map!.setZoom(zoom);
        if (step < frames) requestAnimationFrame(panStep);
        else if (callback) callback();
      }
      panStep();
    },
    [map]
  );

  // Camera flythrough animation when searching for a ride
  const flythroughDoneRef = useRef<string | null>(null);
  useEffect(() => {
    if (!map || !corridaAtiva || corridaAtiva.status !== "buscando") return;
    if (flythroughDoneRef.current === corridaAtiva.id) return;
    flythroughDoneRef.current = corridaAtiva.id;

    const o = { lat: corridaAtiva.origem_lat, lng: corridaAtiva.origem_lng };
    const d = { lat: corridaAtiva.destino_lat, lng: corridaAtiva.destino_lng };

    // Step 1: Zoom into origin (after small delay)
    const t0 = setTimeout(() => {
      animatePan(o, o, 14, 16, 60);
    }, 500);

    // Step 2: Pull back from origin
    const t1 = setTimeout(() => {
      animatePan(o, o, 16, 14, 50);
    }, 3000);

    // Step 3: Smooth pan to destination with zoom in
    const t2 = setTimeout(() => {
      animatePan(o, d, 14, 16, 70);
    }, 5000);

    // Step 4: Fit full route overview
    const t3 = setTimeout(() => {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(o);
      bounds.extend(d);
      map.fitBounds(bounds, 60);

      google.maps.event.addListenerOnce(map, "idle", () => {
        const currentZoom = map.getZoom();
        if (currentZoom && currentZoom > 14) map.setZoom(14);
        if (currentZoom && currentZoom < 10) map.setZoom(10);
      });
    }, 8000);

    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [map, corridaAtiva?.id, corridaAtiva?.status, animatePan]);


  // Load items catalog + categories
  useEffect(() => {
    if (step !== "itens" || itens.length > 0) return;
    const load = async () => {
      try {
        const session = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
        const token = session.data.session?.access_token || apikey;
        const h = { apikey, Authorization: `Bearer ${token}` };

        // Load categories, global items, and overrides in parallel
        const [catRes, itemsRes, ovRes] = await Promise.all([
          fetch(`${baseUrl}/rest/v1/categorias_itens?select=id,nome,icone&ativo=eq.true&order=ordem`, { headers: h }),
          fetch(`${baseUrl}/rest/v1/itens_global?select=id,nome,icone,preco_base,categoria_id&ativo=eq.true&order=nome`, { headers: h }),
          bairroId
            ? fetch(`${baseUrl}/rest/v1/itens_bairro_override?select=item_id,preco_override&bairro_id=eq.${bairroId}&ativo=eq.true`, { headers: h })
            : Promise.resolve(null),
        ]);

        const catsData = await catRes.json();
        const globalItens = await itemsRes.json();
        let overrides: Record<string, number> = {};
        if (ovRes) {
          const ovData = await ovRes.json();
          if (Array.isArray(ovData)) {
            ovData.forEach((o: any) => { overrides[o.item_id] = o.preco_override; });
          }
        }

        if (Array.isArray(catsData)) setCategorias(catsData);
        // Start with "Todos" selected (null = all categories)

        const mapped = (globalItens || []).map((item: any) => ({
          id: item.id,
          nome: item.nome,
          icone: item.icone,
          preco: overrides[item.id] ?? item.preco_base,
          categoria_id: item.categoria_id,
        }));
        setItens(mapped);
      } catch (err) {
        console.error("Erro ao carregar itens:", err);
      }
    };
    load();
  }, [step, bairroId]);

  const handleMapReady = useCallback((m: google.maps.Map) => setMap(m), []);

  const handleManualOriginSelect = useCallback((place: Place) => {
    setOrigin(place);
    setGpsTimedOut(false);
    if (map) map.panTo({ lat: place.lat, lng: place.lng });
  }, [map]);

  const handleOriginConfirm = () => {
    if (!origin) {
      toast.error("Aguardando sua localização...");
      return;
    }
    // Origin marker will be placed only after destination is selected
    setStep("destino");
  };

  const handleDestinationSelect = useCallback(
    (place: Place) => {
      setDestination(place);
      // Place origin marker now that destination is defined
      if (origin) {
        addOrUpdateMarker("origin", { lat: origin.lat, lng: origin.lng }, {
          icon: customIcon("marker_origem") || getDefaultOriginIcon(),
        });
        // Remove client green dot since origin marker replaces it
        removeMarker("myLocation");
      }
      addOrUpdateMarker("destination", { lat: place.lat, lng: place.lng }, {
        icon: customIcon("marker_destino") || getDefaultDestIcon(),
      });
      if (origin) {
        renderRoute({ lat: origin.lat, lng: origin.lng }, { lat: place.lat, lng: place.lng });
      }
    },
    [addOrUpdateMarker, removeMarker, origin, renderRoute]
  );

  const handleDestinationConfirm = () => {
    if (!destination) {
      toast.error("Selecione o destino");
      return;
    }
    setStep("itens");
  };

  const toggleItem = (item: ItemCatalogo, delta: number) => {
    setSelectedItens((prev) => {
      const existing = prev.find((s) => s.item.id === item.id);
      if (existing) {
        const newQtd = existing.qtd + delta;
        if (newQtd <= 0) return prev.filter((s) => s.item.id !== item.id);
        return prev.map((s) => s.item.id === item.id ? { ...s, qtd: newQtd } : s);
      }
      if (delta > 0) return [...prev, { item, qtd: 1 }];
      return prev;
    });
  };

  const totalItens = selectedItens.reduce((sum, s) => sum + s.item.preco * s.qtd, 0);
  const precoKmBase = routeInfo ? routeInfo.distanceKm * valorPorKm : 0;
  const precoKm = precoKmBase * surgeMultiplier;
  const precoAjudanteFinal = comAjudante ? precoAjudante : 0;
  const totalEstimado = totalItens + precoKm + precoAjudanteFinal;

  const handleSubmit = async () => {
    if (!origin || !destination || !clienteId || !bairroId || !routeInfo) return;
    setSubmitting(true);

    try {
      const session = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
      const token = session.data.session?.access_token || apikey;
      const headers = {
        "Content-Type": "application/json",
        apikey,
        Authorization: `Bearer ${token}`,
        Prefer: "return=representation",
      };

      // Fetch client name and photo for denormalization
      const cliInfoRes = await fetch(
        `${baseUrl}/rest/v1/clientes?select=nome,foto_url&id=eq.${clienteId}&limit=1`,
        { headers: { apikey, Authorization: `Bearer ${token}` } }
      );
      const cliInfo = await cliInfoRes.json();
      const clienteNome = cliInfo?.[0]?.nome || "";
      const clienteFotoUrl = cliInfo?.[0]?.foto_url || null;

      // Create corrida
      const corridaRes = await fetch(`${baseUrl}/rest/v1/corridas`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          cliente_id: clienteId,
          bairro_id: bairroId,
          cliente_nome: clienteNome,
          cliente_foto_url: clienteFotoUrl,
          origem_lat: origin.lat,
          origem_lng: origin.lng,
          origem_texto: origin.address,
          destino_lat: destination.lat,
          destino_lng: destination.lng,
          destino_texto: destination.address,
          distancia_km: routeInfo.distanceKm,
          duracao_min: routeInfo.durationMin,
          preco_itens: totalItens,
          preco_km: precoKm,
          preco_total_estimado: totalEstimado,
          forma_pagamento: formaPagamento,
          com_ajudante: comAjudante,
          preco_ajudante: precoAjudanteFinal,
          status: "buscando",
        }),
      });

      if (!corridaRes.ok) {
        const err = await corridaRes.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao criar corrida");
      }

      const [corrida] = await corridaRes.json();

      // Insert items
      if (selectedItens.length > 0 && corrida?.id) {
        const itensBody = selectedItens.map((s) => ({
          corrida_id: corrida.id,
          item_id: s.item.id,
          preco_unit: s.item.preco,
          qtd: s.qtd,
          subtotal: s.item.preco * s.qtd,
        }));

        await fetch(`${baseUrl}/rest/v1/corrida_itens`, {
          method: "POST",
          headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify(itensBody),
        });
      }

      toast.success("Carreto solicitado! Aguardando motorista...");
      setCorridaAtiva(corrida);
      setStep("aguardando");
    } catch (err: any) {
      console.error("Erro ao solicitar carreto:", err);
      toast.error(err.message || "Erro ao solicitar carreto");
    } finally {
      setSubmitting(false);
    }
  };

  // Realtime subscription for corrida updates
  useEffect(() => {
    if (step !== "aguardando" || !corridaAtiva?.id) return;

    const setupRealtime = async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const channel = supabase
        .channel(`corrida-${corridaAtiva.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "corridas",
            filter: `id=eq.${corridaAtiva.id}`,
          },
          (payload: any) => {
            const updated = payload.new;
            setCorridaAtiva((prev: any) => ({ ...prev, ...updated }));
            if (updated.status === "buscando" && !updated.motorista_id) {
              // Motorista cancelled - ride is back to searching
              toast.info("O motorista cancelou. Buscando outro motorista...");
              setPropostas([]);
            } else if ((updated.status === "aceita" || updated.status === "a_caminho") && updated.motorista_id) {
              // Fetch motorista info including vehicle details
              const fetchMotorista = async () => {
                const session = await supabase.auth.getSession();
                const tk = session.data.session?.access_token || apikey;
                const res = await fetch(
                  `${baseUrl}/rest/v1/motoristas?select=nome,foto_url,last_lat,last_lng,placa,tipo_veiculo,marca_veiculo,cor_veiculo,nota_referencia&id=eq.${updated.motorista_id}&limit=1`,
                  { headers: { apikey, Authorization: `Bearer ${tk}` } }
                );
                const mData = await res.json();
                if (mData?.[0]) {
                  setCorridaAtiva((prev: any) => ({
                    ...prev,
                    motorista_nome: mData[0].nome,
                    motorista_foto_url: mData[0].foto_url,
                    motorista_lat: mData[0].last_lat,
                    motorista_lng: mData[0].last_lng,
                    motorista_placa: mData[0].placa,
                    motorista_tipo_veiculo: mData[0].tipo_veiculo,
                    motorista_marca_veiculo: mData[0].marca_veiculo,
                    motorista_cor_veiculo: mData[0].cor_veiculo,
                    motorista_nota: mData[0].nota_referencia,
                  }));
                }
              };
              fetchMotorista();
              if (updated.status === "aceita") toast.success("Um motorista aceitou seu carreto!");
            } else if (updated.status === "chegou") {
              toast.success("O motorista chegou ao local! Informe o código de coleta.");
            } else if (updated.status === "em_deslocamento") {
              toast.success("Coleta confirmada! Motorista a caminho do destino.");
            } else if (updated.status === "finalizada") {
              toast.success("Corrida finalizada!");
              setStep("localizacao");
              setCorridaAtiva(null);
              clearAll();
              clearRoute();
            } else if (updated.status === "cancelada") {
              toast.error("Corrida cancelada");
              setStep("localizacao");
              setCorridaAtiva(null);
              clearAll();
              clearRoute();
            }
          }
        )
        .subscribe();

      return channel;
    };

    let channel: any;
    setupRealtime().then((ch) => { channel = ch; });

    return () => {
      if (channel) {
        import("@/integrations/supabase/client").then(({ supabase }) => {
          supabase.removeChannel(channel);
        });
      }
    };
  }, [step, corridaAtiva?.id]);

  // Auto-cancel after 5 minutes if still searching
  useEffect(() => {
    if (step !== "aguardando" || !corridaAtiva?.id) return;
    if (corridaAtiva.status !== "buscando") return;

    const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    const createdAt = new Date(corridaAtiva.created_at).getTime();
    const elapsed = Date.now() - createdAt;
    const remaining = TIMEOUT_MS - elapsed;

    if (remaining <= 0) {
      // Already expired
      toast.error("Nenhum motorista encontrado. Corrida cancelada automaticamente.");
      handleCancelarCorrida();
      return;
    }

    const timer = setTimeout(() => {
      toast.error("Nenhum motorista encontrado em 5 minutos. Corrida cancelada automaticamente.");
      handleCancelarCorrida();
    }, remaining);

    return () => clearTimeout(timer);
  }, [step, corridaAtiva?.id, corridaAtiva?.status]);

  // Realtime subscription for contra-propostas
  useEffect(() => {
    if (step !== "aguardando" || !corridaAtiva?.id) return;
    if (corridaAtiva.status !== "buscando") return;

    // Load existing proposals
    const loadPropostas = async () => {
      const { data } = await supabase
        .from("contra_propostas")
        .select("*")
        .eq("corrida_id", corridaAtiva.id)
        .eq("status", "pendente")
        .order("valor", { ascending: true });
      setPropostas(data || []);
    };
    loadPropostas();

    const channel = supabase
      .channel(`propostas-${corridaAtiva.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contra_propostas", filter: `corrida_id=eq.${corridaAtiva.id}` },
        (payload: any) => {
          const p = payload.new;
          setPropostas((prev) => prev.some((x) => x.id === p.id) ? prev : [...prev, p].sort((a, b) => a.valor - b.valor));
          toast.info("Nova proposta recebida!");
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [step, corridaAtiva?.id, corridaAtiva?.status]);

  // Poll motorista location when ride is active
  useEffect(() => {
    if (!corridaAtiva?.motorista_id) {
      removeMarker("motorista");
      return;
    }
    if (!["aceita", "a_caminho", "chegou", "carregando", "em_deslocamento"].includes(corridaAtiva?.status)) {
      removeMarker("motorista");
      return;
    }

    // Remove ALL online-driver markers to avoid duplicates on reload
    onlineDriverIds.forEach((id) => removeMarker(`driver-${id}`));
    removeMarker(`driver-${corridaAtiva.motorista_id}`);

    const poll = async () => {
      const session = await supabase.auth.getSession();
      const tk = session.data.session?.access_token || apikey;
      const res = await fetch(
        `${baseUrl}/rest/v1/motoristas?select=last_lat,last_lng,last_heading&id=eq.${corridaAtiva.motorista_id}&limit=1`,
        { headers: { apikey, Authorization: `Bearer ${tk}` } }
      );
      const data = await res.json();
      if (data?.[0]?.last_lat && data?.[0]?.last_lng) {
        const pos = { lat: data[0].last_lat, lng: data[0].last_lng };
        setLastMotoristaPos(pos);
        // Use heading from DB (GPS + bearing fallback computed by driver); fallback to bearing
        let rotation: number = data[0].last_heading ?? null;
        if (rotation === null || rotation === undefined) {
          const prev = prevDriverPositions.current[corridaAtiva.motorista_id];
          rotation = (prev && (prev.lat !== pos.lat || prev.lng !== pos.lng))
            ? calcBearing(prev, pos) : 0;
        }
        prevDriverPositions.current[corridaAtiva.motorista_id] = pos;
        // Use custom marker_motorista icon if uploaded, otherwise blue arrow
        const icons = markerIconsRef.current;
        let driverIcon: google.maps.Icon | google.maps.Symbol;
        if (icons["marker_motorista"]) {
          const rotatedCustom = getRotatedIcon("marker_motorista", rotation, 40);
          driverIcon = rotatedCustom || customIcon("marker_motorista", 40) || getDefaultDriverIcon(rotation);
        } else {
          driverIcon = getDefaultDriverIcon(rotation);
        }
        addOrUpdateMarker("motorista", pos, { icon: driverIcon });
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [corridaAtiva?.motorista_id, corridaAtiva?.status, map, addOrUpdateMarker]);

  const handleAceitarContraProposta = async (propostaId: string) => {
    if (!corridaAtiva) return;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await (supabase.rpc as any)("aceitar_contra_proposta", {
        p_corrida_id: corridaAtiva.id,
        p_proposta_id: propostaId,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.ok) {
        toast.error(result?.erro || "Erro ao aceitar proposta");
        return;
      }
      toast.success("Proposta aceita! Motorista a caminho.");
      setPropostas([]);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCancelarCorrida = async () => {
    if (!corridaAtiva?.id || !clienteId) return;
    try {
      const { data, error } = await (supabase.rpc as any)("cancelar_corrida_cliente", {
        p_corrida_id: corridaAtiva.id,
        p_cliente_id: clienteId,
      });
      if (error) throw new Error(error.message);
      const result = data as any;
      if (!result?.ok) throw new Error(result?.erro || "Erro ao cancelar");
      toast.success("Corrida cancelada");
    } catch (err: any) {
      toast.error(err.message);
      return;
    }
    setStep("localizacao");
    setOrigin(null);
    setDestination(null);
    setSelectedItens([]);
    setCorridaAtiva(null);
    setPropostas([]);
    clearAll();
    clearRoute();
  };

  const goBack = () => {
    if (step === "destino") setStep("localizacao");
    else if (step === "itens") setStep("destino");
    else if (step === "resumo") setStep("itens");
  };

  return (
    <div className="relative overflow-hidden" style={{ height: 'calc(100dvh - 7.5rem)' }}>
      <GoogleMapView
        center={location || bairroCenter || undefined}
        className="w-full h-full"
        onMapReady={handleMapReady}
      />

      {/* Step indicator */}
      {step !== "aguardando" && (
        <div className="absolute top-4 left-4 right-4">
          <div className="flex items-center justify-center gap-2">
            {["localizacao", "destino", "itens", "resumo"].map((s, i) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  ["localizacao", "destino", "itens", "resumo"].indexOf(step) >= i
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom card per step */}
      <div className="absolute bottom-3 left-4 right-4 flex flex-col" style={{ maxHeight: 'calc(100% - 2.5rem)' }}>
        <Card className="shadow-lg overflow-hidden">
          <CardContent className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 11rem)' }}>
            {/* STEP 1: Localização */}
            {step === "localizacao" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-green-500" />
                  <h3 className="font-semibold">Ponto de partida</h3>
                </div>

                {/* GPS detected */}
                {origin && !gpsTimedOut && (
                  <div className="p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate">{origin.address}</span>
                      <button
                        onClick={() => {
                          setOrigin(null);
                          removeMarker("origin");
                        }}
                        className="ml-1 p-0.5 rounded-full hover:bg-muted-foreground/20 text-muted-foreground"
                        aria-label="Limpar partida"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Loading GPS */}
                {!origin && !gpsTimedOut && (
                  <div className="p-3 bg-secondary rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Obtendo sua localização...</span>
                    </div>
                  </div>
                )}

                {/* GPS failed or manual override */}
                {(gpsTimedOut || origin) && (
                  <div className="p-3 bg-secondary rounded-lg">
                    <PlacesAutocomplete
                      placeholder={origin ? "Alterar ponto de partida..." : "Digite o endereço de partida..."}
                      icon="origin"
                      onPlaceSelect={handleManualOriginSelect}
                    />
                  </div>
                )}

                {gpsTimedOut && !origin && (
                  <p className="text-xs text-muted-foreground px-1">
                    Não foi possível obter sua localização. Digite o endereço acima.
                  </p>
                )}

                <Button
                  className="w-full h-12 text-base"
                  onClick={handleOriginConfirm}
                  disabled={!origin}
                >
                  Confirmar partida
                  <ChevronRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            )}

            {/* STEP 2: Destino */}
            {step === "destino" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button onClick={goBack} className="p-1 hover:bg-secondary rounded">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <MapPin className="h-5 w-5 text-destructive" />
                  <h3 className="font-semibold">Para onde?</h3>
                </div>
                <div className="p-3 bg-secondary rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <PlacesAutocomplete
                        placeholder="Buscar endereço de destino..."
                        icon="destination"
                        onPlaceSelect={handleDestinationSelect}
                      />
                    </div>
                    {destination && (
                      <button
                        onClick={() => {
                          setDestination(null);
                          removeMarker("destination");
                          removeMarker("origin");
                          clearRoute();
                        }}
                        className="p-0.5 rounded-full hover:bg-muted-foreground/20 text-muted-foreground"
                        aria-label="Limpar destino"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {routeInfo && (
                  <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
                    <span>{routeInfo.distance} · {routeInfo.duration}</span>
                  </div>
                )}
                <Button
                  className="w-full h-12 text-base"
                  onClick={handleDestinationConfirm}
                  disabled={!destination}
                >
                  Confirmar destino
                  <ChevronRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            )}

            {/* STEP 3: Itens */}
            {step === "itens" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button onClick={goBack} className="p-1 hover:bg-secondary rounded">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <Package className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">O que vai levar?</h3>
                </div>

                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar item por nome..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (e.target.value) setSelectedCatId(null);
                    }}
                    className="pl-9 h-9 text-sm"
                  />
                </div>

                {/* Category tabs */}
                {categorias.length > 0 && !searchQuery && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    <button
                      onClick={() => setSelectedCatId(null)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        selectedCatId === null
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      }`}
                    >
                      Todos
                    </button>
                    {categorias.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCatId(cat.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                          selectedCatId === cat.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        {cat.nome}
                      </button>
                    ))}
                  </div>
                )}

                {/* Filtered items */}
                <div className="max-h-44 overflow-y-auto space-y-2">
                  {itens.length === 0 ? (
                    <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Carregando itens...
                    </div>
                  ) : (
                    itens
                      .filter((item) => {
                        if (searchQuery) return item.nome.toLowerCase().includes(searchQuery.toLowerCase());
                        return !selectedCatId || item.categoria_id === selectedCatId;
                      })
                      .map((item) => {
                        const sel = selectedItens.find((s) => s.item.id === item.id);
                        const qtd = sel?.qtd || 0;
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 bg-secondary rounded-lg"
                          >
                            <div>
                              <p className="text-sm font-medium">{item.nome}</p>
                              <p className="text-xs text-muted-foreground">
                                R$ {item.preco.toFixed(2)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleItem(item, -1)}
                                className="h-8 w-8 flex items-center justify-center rounded-full bg-background border hover:bg-muted"
                                disabled={qtd === 0}
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="w-6 text-center text-sm font-medium">{qtd}</span>
                              <button
                                onClick={() => toggleItem(item, 1)}
                                className="h-8 w-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                  )}
                  {itens.length > 0 && itens.filter((item) => !selectedCatId || item.categoria_id === selectedCatId).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum item nesta categoria</p>
                  )}
                </div>

                {/* Selected items count */}
                {selectedItens.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedItens.reduce((sum, s) => sum + s.qtd, 0)} item(ns) selecionado(s)
                  </p>
                )}

                <Button
                  className="w-full h-12 text-base"
                  onClick={() => setStep("resumo")}
                >
                  Ver resumo
                  <ChevronRight className="h-5 w-5 ml-2" />
                </Button>
              </div>
            )}

            {/* STEP 4: Resumo */}
            {step === "resumo" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button onClick={goBack} className="p-1 hover:bg-secondary rounded">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h3 className="font-semibold">Resumo do carreto</h3>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2 p-2 bg-secondary rounded">
                    <Navigation className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    <span className="line-clamp-1">{origin?.address}</span>
                  </div>
                  <div className="flex items-start gap-2 p-2 bg-secondary rounded">
                    <MapPin className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <span className="line-clamp-1">{destination?.address}</span>
                  </div>
                </div>

                {routeInfo && (
                  <div className="text-xs text-muted-foreground px-1">
                    {routeInfo.distance} · {routeInfo.duration}
                  </div>
                )}

                <div className="border-t pt-2 space-y-1 text-sm">
                  <div className="max-h-32 overflow-y-auto space-y-1">
                  {selectedItens.map((s) => (
                    <div key={s.item.id} className="flex justify-between">
                      <span>{s.qtd}x {s.item.nome}</span>
                      <span>R$ {(s.item.preco * s.qtd).toFixed(2)}</span>
                    </div>
                  ))}
                  </div>
                  {routeInfo && (
                    <div className="flex justify-between">
                      <span>
                        Distância ({routeInfo.distanceKm.toFixed(1)} km)
                        {surgeMultiplier > 1 && (
                          <Badge variant="secondary" className="ml-1 text-xs">{surgeMultiplier}x</Badge>
                        )}
                      </span>
                      <span>R$ {precoKm.toFixed(2)}</span>
                    </div>
                  )}
                  {comAjudante && precoAjudante > 0 && (
                    <div className="flex justify-between">
                      <span>Ajudante</span>
                      <span>R$ {precoAjudante.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1 border-t">
                    <span>Total estimado</span>
                    <span>R$ {totalEstimado.toFixed(2)}</span>
                  </div>
                </div>

                {/* Ajudante toggle */}
                {precoAjudante > 0 && (
                  <div className="border-t pt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Precisa de ajudante?</p>
                        <p className="text-xs text-muted-foreground">+ R$ {precoAjudante.toFixed(2)}</p>
                      </div>
                      <Switch checked={comAjudante} onCheckedChange={setComAjudante} />
                    </div>
                  </div>
                )}

                {/* Forma de pagamento */}
                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-2">Forma de pagamento</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormaPagamento("dinheiro")}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                        formaPagamento === "dinheiro"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted bg-secondary text-secondary-foreground"
                      }`}
                    >
                      <Banknote className="h-5 w-5" />
                      Dinheiro
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormaPagamento("pix")}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                        formaPagamento === "pix"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted bg-secondary text-secondary-foreground"
                      }`}
                    >
                      <QrCode className="h-5 w-5" />
                      PIX
                    </button>
                  </div>
                </div>
                <Button
                  className="w-full h-12 text-base"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Enviando...</>
                  ) : (
                    <><Package className="h-5 w-5 mr-2" />Chamar carreto</>
                  )}
                </Button>
              </div>
            )}

            {/* STEP 5: Aguardando */}
            {step === "aguardando" && (
              <div className="space-y-3 py-2">
                {/* Propostas de motoristas */}
                {corridaAtiva?.status === "buscando" ? (
                  <>
                    {propostas.length > 0 ? (
                      <>
                        <div className="text-center">
                          <DollarSign className="h-8 w-8 text-primary mx-auto mb-1" />
                          <h3 className="font-semibold">Propostas recebidas ({propostas.length})</h3>
                          <p className="text-xs text-muted-foreground">Seu valor: R$ {Number(corridaAtiva.preco_total_estimado).toFixed(2)}</p>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {propostas.map((p) => (
                            <div key={p.id} className="p-3 bg-secondary rounded-lg">
                              <div className="flex items-center gap-3">
                                <ZoomableAvatar
                                  src={p.motorista_foto_url ? `${baseUrl}/storage/v1/object/public/profile-photos/${p.motorista_foto_url}` : null}
                                  alt={p.motorista_nome}
                                  fallbackIcon={<Navigation className="h-4 w-4 text-muted-foreground" />}
                                  size="sm"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm">{titleCase(p.motorista_nome)}</p>
                                  <div className="flex items-center gap-2">
                                    <StarRating nota={p.motorista_nota || 5} size="sm" />
                                    <span className="text-xs text-muted-foreground">
                                      {p.motorista_veiculo && titleCase(p.motorista_veiculo)}
                                      {p.motorista_placa && ` · ${p.motorista_placa.toUpperCase()}`}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-lg font-bold text-primary">R$ {Number(p.valor).toFixed(2)}</p>
                                </div>
                              </div>
                              <Button className="w-full mt-2 h-9" size="sm" onClick={() => handleAceitarContraProposta(p.id)}>
                                <Check className="h-4 w-4 mr-1" /> Aceitar proposta
                              </Button>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-center py-2">
                          <Loader2 className="h-8 w-8 text-primary mx-auto mb-2 animate-spin" />
                          <h3 className="font-semibold">Buscando carreto...</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Aguardando propostas de motoristas da região
                          </p>
                        </div>
                      </>
                    )}
                    {/* Cancel button */}
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={handleCancelarCorrida}
                    >
                      Cancelar corrida
                    </Button>
                  </>
                ) : ["aceita", "a_caminho", "chegou", "carregando", "em_deslocamento"].includes(corridaAtiva?.status) ? (
                  <div className="space-y-3">
                    {/* Motorista info with vehicle */}
                    <div className="flex items-center gap-3">
                      <ZoomableAvatar
                        src={corridaAtiva?.motorista_foto_url ? `${baseUrl}/storage/v1/object/public/profile-photos/${corridaAtiva.motorista_foto_url}` : null}
                        alt="Motorista"
                        fallbackIcon={<Navigation className="h-6 w-6 text-muted-foreground" />}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{titleCase(corridaAtiva?.motorista_nome) || "Motorista"}</p>
                        <div className="flex items-center gap-2">
                          <StarRating nota={corridaAtiva?.motorista_nota || 5} size="sm" />
                          <span className="text-xs text-muted-foreground">
                            {corridaAtiva?.status === "aceita" && "Corrida aceita"}
                            {corridaAtiva?.status === "a_caminho" && "A caminho de você"}
                            {corridaAtiva?.status === "chegou" && "Chegou ao local!"}
                            {corridaAtiva?.status === "carregando" && "Aguardando confirmação..."}
                            {corridaAtiva?.status === "em_deslocamento" && "A caminho do destino"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Vehicle info */}
                    {corridaAtiva?.motorista_placa && (
                      <div className="flex items-center gap-2 p-2 bg-secondary rounded-lg text-sm">
                        <Car className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium">{titleCase(corridaAtiva.motorista_tipo_veiculo)}</span>
                        <span className="text-muted-foreground">{titleCase(corridaAtiva.motorista_marca_veiculo)} {titleCase(corridaAtiva.motorista_cor_veiculo)}</span>
                        <span className="ml-auto font-mono font-bold">{corridaAtiva.motorista_placa?.toUpperCase()}</span>
                      </div>
                    )}

                    {/* Status progress */}
                    <div className="flex gap-1">
                      {["aceita", "a_caminho", "chegou", "em_deslocamento"].map((s, i) => (
                        <div
                          key={s}
                          className={`h-1.5 flex-1 rounded-full ${
                            ["aceita", "a_caminho", "chegou", "em_deslocamento"].indexOf(corridaAtiva?.status) >= i
                              ? "bg-primary"
                              : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>

                    {/* Show pickup code for client to tell driver */}
                    {corridaAtiva?.status === "chegou" && corridaAtiva?.codigo_coleta && (
                      <div className="p-3 bg-primary/10 rounded-lg text-center space-y-1">
                        <p className="text-xs text-muted-foreground">Informe este código ao motorista para confirmar a coleta:</p>
                        <p className="text-3xl font-bold tracking-widest text-primary">{corridaAtiva.codigo_coleta}</p>
                      </div>
                    )}

                    {/* Show delivery code for client to tell driver */}
                    {corridaAtiva?.status === "em_deslocamento" && corridaAtiva?.codigo_entrega && (
                      <div className="p-3 bg-primary/10 rounded-lg text-center space-y-1">
                        <p className="text-xs text-muted-foreground">No destino, informe este código ao motorista:</p>
                        <p className="text-3xl font-bold tracking-widest text-primary">{corridaAtiva.codigo_entrega}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        R$ {Number(corridaAtiva.preco_total_estimado).toFixed(2)}
                        {corridaAtiva.distancia_km && ` · ${Number(corridaAtiva.distancia_km).toFixed(1)} km`}
                      </span>
                      {user && (
                        <ChatDrawer
                          corridaId={corridaAtiva.id}
                          currentUserId={user.id}
                          currentUserType="cliente"
                        />
                      )}
                    </div>
                  </div>
                ) : null}

              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
