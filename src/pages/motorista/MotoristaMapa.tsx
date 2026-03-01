import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wifi, WifiOff, MapPin, Navigation, Package, Check, X, DollarSign, Loader2, User, Lock, Banknote, QrCode, XCircle, Users, ExternalLink } from "lucide-react";
import { StarRating } from "@/components/StarRating";
import { ChatDrawer } from "@/components/chat/ChatDrawer";
import { ZoomableAvatar } from "@/components/ZoomableAvatar";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { GoogleMapView, useMapMarkers } from "@/components/maps/GoogleMapView";
import { useCurrentLocation } from "@/hooks/useGoogleMaps";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { useRideAlert } from "@/hooks/useRideAlert";
import { titleCase } from "@/lib/utils";

interface CorridaItem {
  id: string;
  item_nome: string;
  preco_unit: number;
  qtd: number;
  subtotal: number;
}

interface Corrida {
  id: string;
  origem_texto: string;
  destino_texto: string;
  distancia_km: number | null;
  duracao_min: number | null;
  preco_total_estimado: number;
  preco_itens: number;
  preco_km: number;
  status: string;
  forma_pagamento?: string;
  cliente_nome?: string;
  cliente_foto_url?: string | null;
  itens?: CorridaItem[];
  codigo_coleta?: string;
  codigo_entrega?: string;
  com_ajudante?: boolean;
  preco_ajudante?: number;
}

export default function MotoristaMapa() {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [motoristaData, setMotoristaData] = useState<any>(null);
  const [bairroCenter, setBairroCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [selectedCorrida, setSelectedCorrida] = useState<Corrida | null>(null);
  const [corridaAceita, setCorridaAceita] = useState<{ corrida: Corrida; cliente_nome: string; cliente_foto: string | null; forma_pagamento: string } | null>(null);
  const [contraValor, setContraValor] = useState("");
  const [showContra, setShowContra] = useState(false);
  const [propostaEnviada, setPropostaEnviada] = useState<Set<string>>(new Set());
  const [recusadas, setRecusadas] = useState<Set<string>>(new Set());
  const [codigoInput, setCodigoInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const { location, heading, startWatching, stopWatching } = useCurrentLocation();
  const { addOrUpdateMarker } = useMapMarkers(map);
  const prevCorridaIdsRef = useRef<string>("");

  // Sound alert - plays when new rides appear, stops when list is empty or user interacts
  const { stopAlert } = useRideAlert(isOnline && corridas.length > 0 && !selectedCorrida && !corridaAceita);

  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const getToken = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const session = await supabase.auth.getSession();
    return session.data.session?.access_token || apikey;
  };

  const fetchItens = async (corridaId: string): Promise<CorridaItem[]> => {
    try {
      const h = await headers();
      const res = await fetch(
        `${baseUrl}/rest/v1/corrida_itens?select=id,preco_unit,qtd,subtotal,itens_global(nome)&corrida_id=eq.${corridaId}`,
        { headers: h }
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map((d: any) => ({
          id: d.id,
          item_nome: d.itens_global?.nome || "Item",
          preco_unit: d.preco_unit,
          qtd: d.qtd,
          subtotal: d.subtotal,
        }));
      }
    } catch (err) {
      console.error("Erro ao carregar itens:", err);
    }
    return [];
  };

  const headers = async () => {
    const token = await getToken();
    return { apikey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  };

  // Load motorista data + bairro center + check existing active ride
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const h = await headers();
      const res = await fetch(
        `${baseUrl}/rest/v1/motoristas?select=*,bairros(lat,lng)&user_id=eq.${user.id}&limit=1`,
        { headers: h }
      );
      const data = await res.json();
      if (data?.[0]) {
        setMotoristaData(data[0]);
        setIsOnline(data[0].status_online === "online");
        if (data[0].bairros?.lat && data[0].bairros?.lng) {
          setBairroCenter({ lat: data[0].bairros.lat, lng: data[0].bairros.lng });
        }

        // Check for existing accepted ride
        const activeRes = await fetch(
          `${baseUrl}/rest/v1/corridas?select=*&motorista_id=eq.${data[0].id}&status=in.(aceita,a_caminho,chegou,carregando,em_deslocamento)&limit=1`,
          { headers: h }
        );
        const activeData = await activeRes.json();
        if (activeData?.[0]) {
          const corrida = activeData[0];
          const [cliRes, itens] = await Promise.all([
            fetch(`${baseUrl}/rest/v1/corridas?select=cliente_id,forma_pagamento,clientes(nome,foto_url)&id=eq.${corrida.id}&limit=1`, { headers: h }),
            fetchItens(corrida.id),
          ]);
          const cliData = await cliRes.json();
          setCorridaAceita({
            corrida: { ...corrida, itens },
            cliente_nome: cliData?.[0]?.clientes?.nome || "Cliente",
            cliente_foto: cliData?.[0]?.clientes?.foto_url || null,
            forma_pagamento: cliData?.[0]?.forma_pagamento || "dinheiro",
          });
        }
      }
    };
    load();
  }, [user]);

  // Update location marker
  useEffect(() => {
    if (!location || !map) return;
    addOrUpdateMarker("me", location, {
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#2563EB",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 3,
      },
    });
  }, [location, map, addOrUpdateMarker]);

  // Send location updates when online
  const headingRef = useRef<number>(0);
  useEffect(() => { headingRef.current = heading; }, [heading]);

  const sendLocation = useCallback(async (loc: { lat: number; lng: number }) => {
    if (!motoristaData) return;
    try {
      const h = await headers();
      await fetch(`${baseUrl}/rest/v1/motoristas?id=eq.${motoristaData.id}`, {
        method: "PATCH",
        headers: { ...h, Prefer: "return=minimal" },
        body: JSON.stringify({
          last_lat: loc.lat,
          last_lng: loc.lng,
          last_heading: headingRef.current,
          last_seen: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error("Erro ao enviar localização:", err);
    }
  }, [motoristaData, baseUrl]);

  // Dynamic interval: 5s during active ride, 15s when online without ride
  const locationIntervalMs = corridaAceita ? 5000 : 15000;

  useEffect(() => {
    if (!isOnline || !motoristaData || !location) return;

    // Send immediately
    sendLocation(location);

    const interval = setInterval(() => {
      if (location) sendLocation(location);
    }, locationIntervalMs);

    return () => clearInterval(interval);
  }, [isOnline, motoristaData, location, sendLocation, locationIntervalMs]);

  // Poll for available corridas using RPC (max 3, random, excluding refused)
  useEffect(() => {
    if (!isOnline || !motoristaData) return;

    const poll = async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await (supabase.rpc as any)("corridas_disponiveis_motorista", {
          p_motorista_id: motoristaData.id,
          p_excluir_ids: Array.from(recusadas),
        });
        if (error) { console.error("Erro ao buscar corridas:", error); return; }
        if (Array.isArray(data)) {
          // Check if new rides appeared (to trigger sound)
          const newIds = data.map((c: any) => c.id).sort().join(",");
          if (newIds !== prevCorridaIdsRef.current && data.length > 0 && prevCorridaIdsRef.current !== "") {
            // New rides detected - sound hook handles this via corridas.length > 0
          }
          prevCorridaIdsRef.current = newIds;
          setCorridas(data.map((c: any) => ({
            id: c.id,
            origem_texto: c.origem_texto,
            destino_texto: c.destino_texto,
            distancia_km: c.distancia_km,
            duracao_min: c.duracao_min,
            preco_total_estimado: c.preco_total_estimado,
            preco_itens: c.preco_itens,
            preco_km: c.preco_km,
            status: c.status,
            forma_pagamento: c.forma_pagamento,
            cliente_nome: c.cliente_nome,
            cliente_foto_url: c.cliente_foto_url,
            com_ajudante: c.com_ajudante,
            preco_ajudante: c.preco_ajudante,
          })));
        }
      } catch (err) {
        console.error("Erro no polling:", err);
      }
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [isOnline, motoristaData, recusadas]);

  // Realtime subscription for accepted ride status changes
  useEffect(() => {
    if (!corridaAceita) return;

    const setupRealtime = async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const channel = supabase
        .channel(`motorista-corrida-${corridaAceita.corrida.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "corridas",
            filter: `id=eq.${corridaAceita.corrida.id}`,
          },
          (payload: any) => {
            const updated = payload.new;
            if (updated.status === "cancelada") {
              toast.error("Corrida cancelada pelo cliente");
              setCorridaAceita(null);
              setCodigoInput("");
            } else if (updated.status === "aceita") {
              // Contraproposta aceita pelo cliente - load items if not already loaded
              fetchItens(updated.id).then((itens) => {
                setCorridaAceita((prev) =>
                  prev ? { ...prev, corrida: { ...prev.corrida, ...updated, itens: prev.corrida.itens?.length ? prev.corrida.itens : itens } } : prev
                );
              });
            } else {
              // Sync any status changes
              setCorridaAceita((prev) =>
                prev ? { ...prev, corrida: { ...prev.corrida, ...updated } } : prev
              );
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
  }, [corridaAceita?.corrida?.id]);

  const toggleOnline = async () => {
    if (!motoristaData) return;
    if (motoristaData.status_kyc !== "aprovado") {
      toast.error("Seu KYC ainda não foi aprovado");
      return;
    }

    const newStatus = isOnline ? "offline" : "online";
    const h = await headers();
    const res = await fetch(`${baseUrl}/rest/v1/motoristas?id=eq.${motoristaData.id}`, {
      method: "PATCH",
      headers: { ...h, Prefer: "return=minimal" },
      body: JSON.stringify({ status_online: newStatus }),
    });

    if (!res.ok) {
      toast.error("Erro ao mudar status");
      return;
    }

    setIsOnline(!isOnline);
    if (newStatus === "online") {
      startWatching();
      toast.success("Você está online!");
    } else {
      stopWatching();
      setCorridas([]);
      setSelectedCorrida(null);
      setRecusadas(new Set());
      stopAlert();
      toast.success("Você está offline");
    }
  };

  const handleRecusar = (corridaId: string) => {
    setRecusadas((prev) => new Set(prev).add(corridaId));
    setCorridas((prev) => prev.filter((c) => c.id !== corridaId));
    if (selectedCorrida?.id === corridaId) {
      setSelectedCorrida(null);
      setShowContra(false);
    }
    stopAlert();
  };

  const handleAceitar = async (corrida: Corrida) => {
    if (!motoristaData) return;
    setActionLoading(true);

    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await (supabase.rpc as any)("aceitar_corrida", {
        p_corrida_id: corrida.id,
        p_motorista_id: motoristaData.id,
      });

      if (error) throw error;
      const result = data as any;
      if (!result?.ok) {
        toast.error(result?.erro || "Erro ao aceitar corrida");
        return;
      }

      toast.success(`Corrida aceita! Taxa: R$ ${Number(result.taxa_creditos).toFixed(2)}`);

      // Fetch client info and items in parallel
      const h = await headers();
      const [cliRes, itens] = await Promise.all([
        fetch(`${baseUrl}/rest/v1/corridas?select=cliente_id,forma_pagamento,clientes(nome,foto_url)&id=eq.${corrida.id}&limit=1`, { headers: h }),
        fetchItens(corrida.id),
      ]);
      const cliData = await cliRes.json();
      const clienteNome = cliData?.[0]?.clientes?.nome || "Cliente";
      const clienteFoto = cliData?.[0]?.clientes?.foto_url || null;
      const formaPag = cliData?.[0]?.forma_pagamento || "dinheiro";

      setCorridaAceita({ corrida: { ...corrida, status: "aceita", itens }, cliente_nome: clienteNome, cliente_foto: clienteFoto, forma_pagamento: formaPag });
      setCorridas((prev) => prev.filter((c) => c.id !== corrida.id));
      setSelectedCorrida(null);

      // Refresh saldo
      const mRes = await fetch(
        `${baseUrl}/rest/v1/motoristas?select=saldo_creditos&id=eq.${motoristaData.id}&limit=1`,
        { headers: h }
      );
      const mData = await mRes.json();
      if (mData?.[0]) {
        setMotoristaData((prev: any) => ({ ...prev, saldo_creditos: mData[0].saldo_creditos }));
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao aceitar");
    } finally {
      setActionLoading(false);
    }
  };

  const handleContraProposta = async (corrida: Corrida) => {
    const valor = parseFloat(contraValor);
    if (isNaN(valor) || valor <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (!motoristaData) return;
    setActionLoading(true);

    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await (supabase.rpc as any)("enviar_contra_proposta", {
        p_corrida_id: corrida.id,
        p_motorista_id: motoristaData.id,
        p_valor: valor,
      });

      if (error) throw error;
      const result = data as any;
      if (!result?.ok) {
        toast.error(result?.erro || "Erro ao enviar contra-proposta");
        return;
      }

      toast.success("Proposta enviada! Aguardando resposta do cliente.");
      setPropostaEnviada((prev) => new Set(prev).add(corrida.id));
      // Hide this ride for 20 seconds
      const rideId = corrida.id;
      setRecusadas((prev) => new Set(prev).add(rideId));
      setCorridas((prev) => prev.filter((c) => c.id !== rideId));
      setTimeout(() => {
        setRecusadas((prev) => {
          const next = new Set(prev);
          next.delete(rideId);
          return next;
        });
      }, 20000);
      setSelectedCorrida(null);
      setShowContra(false);
      setContraValor("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectCorrida = async (corrida: Corrida) => {
    setSelectedCorrida(corrida);
    // Load items for this corrida
    try {
      const h = await headers();
      const res = await fetch(
        `${baseUrl}/rest/v1/corrida_itens?select=id,preco_unit,qtd,subtotal,itens_global(nome)&corrida_id=eq.${corrida.id}`,
        { headers: h }
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        const itens: CorridaItem[] = data.map((d: any) => ({
          id: d.id,
          item_nome: d.itens_global?.nome || "Item",
          preco_unit: d.preco_unit,
          qtd: d.qtd,
          subtotal: d.subtotal,
        }));
        setSelectedCorrida((prev) => prev ? { ...prev, itens } : prev);
      }
    } catch (err) {
      console.error("Erro ao carregar itens:", err);
    }
  };

  const generateCode = () => String(Math.floor(1000 + Math.random() * 9000));

  const handleUpdateStatus = async (newStatus: string) => {
    if (!corridaAceita) return;
    setActionLoading(true);
    try {
      const h = await headers();
      const body: Record<string, any> = { status: newStatus };

      // Generate pickup code when arriving
      if (newStatus === "chegou") {
        body.codigo_coleta = generateCode();
      }

      const res = await fetch(`${baseUrl}/rest/v1/corridas?id=eq.${corridaAceita.corrida.id}`, {
        method: "PATCH",
        headers: { ...h, Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Erro ao atualizar status");

      const [updated] = await res.json();

      if (newStatus === "finalizada") {
        toast.success("Corrida finalizada!");
        setCorridaAceita(null);
        setCodigoInput("");
      } else {
        setCorridaAceita((prev) =>
          prev ? { ...prev, corrida: { ...prev.corrida, ...updated } } : prev
        );
        setCodigoInput("");
        const msgs: Record<string, string> = {
          a_caminho: "Status: a caminho do cliente",
          chegou: "Você chegou ao local! Peça o código ao cliente.",
        };
        if (msgs[newStatus]) toast.success(msgs[newStatus]);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMapReady = useCallback((m: google.maps.Map) => setMap(m), []);

  const handleCancelarCorridaMotorista = async () => {
    if (!corridaAceita || !motoristaData) return;
    setActionLoading(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await (supabase.rpc as any)("cancelar_corrida_motorista", {
        p_corrida_id: corridaAceita.corrida.id,
        p_motorista_id: motoristaData.id,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.ok) {
        toast.error(result?.erro || "Erro ao cancelar");
        return;
      }
      const credDevolvidos = result.creditos_devolvidos || 0;
      toast.success(credDevolvidos > 0
        ? `Corrida devolvida. R$ ${Number(credDevolvidos).toFixed(2)} estornados.`
        : "Corrida devolvida. Outro motorista poderá aceitar.");
      // Cooldown: hide this ride from driver for 2 minutes
      const cancelledRideId = corridaAceita.corrida.id;
      setRecusadas((prev) => new Set(prev).add(cancelledRideId));
      setTimeout(() => {
        setRecusadas((prev) => {
          const next = new Set(prev);
          next.delete(cancelledRideId);
          return next;
        });
      }, 120000); // 2 minutes
      setCorridaAceita(null);
      setCodigoInput("");
      // Refresh saldo
      const h = await headers();
      const mRes = await fetch(
        `${baseUrl}/rest/v1/motoristas?select=saldo_creditos&id=eq.${motoristaData.id}&limit=1`,
        { headers: h }
      );
      const mData = await mRes.json();
      if (mData?.[0]) {
        setMotoristaData((prev: any) => ({ ...prev, saldo_creditos: mData[0].saldo_creditos }));
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleValidatePickupCode = async () => {
    if (!corridaAceita) return;
    if (codigoInput !== corridaAceita.corrida.codigo_coleta) {
      toast.error("Código incorreto!");
      return;
    }
    // Code is correct, generate delivery code and move to carregando
    setActionLoading(true);
    try {
      const h = await headers();
      const deliveryCode = generateCode();
      const res = await fetch(`${baseUrl}/rest/v1/corridas?id=eq.${corridaAceita.corrida.id}`, {
        method: "PATCH",
        headers: { ...h, Prefer: "return=representation" },
        body: JSON.stringify({ status: "em_deslocamento", codigo_entrega: deliveryCode }),
      });
      if (!res.ok) throw new Error("Erro ao confirmar coleta");
      const [updated] = await res.json();
      setCorridaAceita((prev) => prev ? { ...prev, corrida: { ...prev.corrida, ...updated } } : prev);
      setCodigoInput("");
      toast.success("Coleta confirmada! A caminho do destino.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleValidateDeliveryCode = async () => {
    if (!corridaAceita) return;
    if (codigoInput !== corridaAceita.corrida.codigo_entrega) {
      toast.error("Código incorreto!");
      return;
    }
    await handleUpdateStatus("finalizada");
  };

  // Open external navigation (Waze priority, fallback Google Maps)
  const openNavigation = (destLat: number, destLng: number) => {
    // Try Waze first, then Google Maps
    const wazeUrl = `https://waze.com/ul?ll=${destLat},${destLng}&navigate=yes`;
    const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`;

    // On mobile, try Waze deep link; fallback to Google Maps
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      // Try opening Waze; if it fails, open Google Maps
      const w = window.open(wazeUrl, "_blank");
      if (!w) window.open(googleUrl, "_blank");
    } else {
      window.open(googleUrl, "_blank");
    }
  };

  // Get navigation destination based on ride status
  const getNavDestination = (): { lat: number; lng: number; label: string } | null => {
    if (!corridaAceita) return null;
    const c = corridaAceita.corrida as any;
    if (["aceita", "a_caminho", "chegou"].includes(c.status)) {
      return { lat: c.origem_lat, lng: c.origem_lng, label: "Ir até o cliente" };
    }
    if (["carregando", "em_deslocamento"].includes(c.status)) {
      return { lat: c.destino_lat, lng: c.destino_lng, label: "Ir até o destino" };
    }
    return null;
  };

  return (
    <div className="relative overflow-hidden" style={{ height: 'calc(100dvh - 7.5rem)' }}>
      <GoogleMapView
        center={location || bairroCenter || undefined}
        className="w-full h-full"
        onMapReady={handleMapReady}
      />

      {/* Status bar */}
      <div className="absolute top-4 left-4 right-4">
        <Card className="shadow-lg">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              {isOnline ? <Wifi className="h-5 w-5 text-green-500" /> : <WifiOff className="h-5 w-5 text-muted-foreground" />}
              <div>
                <p className="font-semibold text-sm">{isOnline ? "Online" : "Offline"}</p>
                <p className="text-xs text-muted-foreground">
                  {motoristaData ? (
                    <span className="inline-flex items-center gap-1">Saldo: R$ {Number(motoristaData.saldo_creditos).toFixed(2)} · <StarRating nota={motoristaData.nota_referencia ?? 5} size="sm" /></span>
                  ) : "Carregando..."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isOnline && corridas.length > 0 && (
                <Badge variant="default">{corridas.length} corrida{corridas.length > 1 ? "s" : ""}</Badge>
              )}
              <Switch checked={isOnline} onCheckedChange={toggleOnline} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KYC Pending */}
      {motoristaData?.status_kyc === "pendente_analise" && (
        <div className="absolute bottom-3 left-4 right-4">
          <Card className="shadow-lg">
            <CardContent className="py-4 text-center">
              <Badge className="bg-yellow-500 text-white mb-2">KYC Pendente</Badge>
              <p className="text-sm text-muted-foreground">
                Seu cadastro está em análise. Aguarde a aprovação para ficar online.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Available rides list */}
      {isOnline && !selectedCorrida && !corridaAceita && corridas.length > 0 && motoristaData?.status_kyc === "aprovado" && (
        <div className="absolute bottom-3 left-4 right-4 max-h-60 overflow-y-auto space-y-2">
          {corridas.map((c) => (
            <Card key={c.id} className="shadow-lg hover:ring-2 ring-primary transition-all">
              <CardContent className="p-3 space-y-1">
                <div className="flex items-start justify-between">
                  <div className="flex-1 cursor-pointer space-y-1" onClick={() => { stopAlert(); handleSelectCorrida(c); }}>
                    <div className="flex items-center gap-2 mb-1">
                      <ZoomableAvatar
                        src={c.cliente_foto_url ? `${baseUrl}/storage/v1/object/public/profile-photos/${c.cliente_foto_url}` : null}
                        alt={c.cliente_nome || "Cliente"}
                        size="sm"
                        fallbackIcon={<User className="h-4 w-4 text-muted-foreground" />}
                      />
                      <span className="font-semibold text-sm">{titleCase(c.cliente_nome || "Cliente")}</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <Navigation className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span className="line-clamp-1">{c.origem_texto}</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <span className="line-clamp-1">{c.destino_texto}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRecusar(c.id); }}
                    className="p-1.5 hover:bg-destructive/10 rounded-full transition-colors shrink-0 ml-2"
                    title="Recusar"
                  >
                    <XCircle className="h-5 w-5 text-destructive" />
                  </button>
                </div>
                <div className="flex items-center justify-between text-sm pt-1">
                  <span className="text-muted-foreground">
                    {c.distancia_km ? `${Number(c.distancia_km).toFixed(1)} km` : ""}
                    {c.duracao_min ? ` · ${c.duracao_min} min` : ""}
                  </span>
                  <div className="flex items-center gap-2">
                     {c.com_ajudante && (
                       <Badge variant="secondary" className="gap-1 text-xs">
                         <Users className="h-3 w-3" /> Ajudante
                       </Badge>
                     )}
                    <span className="font-bold text-primary">R$ {Number(c.preco_total_estimado).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Selected ride detail */}
      {selectedCorrida && (
        <div className="absolute bottom-3 left-4 right-4" style={{ maxHeight: 'calc(100% - 2.5rem)' }}>
          <Card className="shadow-lg overflow-hidden">
            <CardContent className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 11rem)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ZoomableAvatar
                    src={selectedCorrida.cliente_foto_url ? `${baseUrl}/storage/v1/object/public/profile-photos/${selectedCorrida.cliente_foto_url}` : null}
                    alt={selectedCorrida.cliente_nome || "Cliente"}
                    size="sm"
                    fallbackIcon={<User className="h-4 w-4 text-muted-foreground" />}
                  />
                  <h3 className="font-semibold">{titleCase(selectedCorrida.cliente_nome || "Cliente")}</h3>
                </div>
                <button onClick={() => { setSelectedCorrida(null); setShowContra(false); }} className="p-1 hover:bg-secondary rounded">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2 p-2 bg-secondary rounded">
                  <Navigation className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>{selectedCorrida.origem_texto}</span>
                </div>
                <div className="flex items-start gap-2 p-2 bg-secondary rounded">
                  <MapPin className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <span>{selectedCorrida.destino_texto}</span>
                </div>
              </div>

              {/* Items list */}
              {selectedCorrida.itens && selectedCorrida.itens.length > 0 && (
                <div className="border-t pt-2 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Package className="h-3 w-3" /> Itens do carreto
                  </p>
                  <div className="max-h-[7.5rem] overflow-y-auto space-y-1">
                    {selectedCorrida.itens.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>{item.qtd}x {item.item_nome}</span>
                        <span>R$ {Number(item.subtotal).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ajudante info */}
               {selectedCorrida.com_ajudante && (
                 <div className="flex items-center gap-2 p-2 bg-accent rounded text-sm">
                   <Users className="h-4 w-4 text-primary shrink-0" />
                   <span className="font-medium">Com ajudante</span>
                   <span className="ml-auto">+ R$ {Number(selectedCorrida.preco_ajudante || 0).toFixed(2)}</span>
                 </div>
               )}

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>
                    {selectedCorrida.distancia_km ? `${Number(selectedCorrida.distancia_km).toFixed(1)} km` : ""}
                    {selectedCorrida.duracao_min ? ` · ${selectedCorrida.duracao_min} min` : ""}
                  </span>
                  {(selectedCorrida as any).forma_pagamento && (
                    <Badge variant="outline" className="gap-1 text-xs">
                      {(selectedCorrida as any).forma_pagamento === "pix" ? <QrCode className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
                      {(selectedCorrida as any).forma_pagamento === "pix" ? "PIX" : "Dinheiro"}
                    </Badge>
                  )}
                </div>
                <span className="font-bold text-lg">R$ {Number(selectedCorrida.preco_total_estimado).toFixed(2)}</span>
              </div>

              {propostaEnviada.has(selectedCorrida.id) ? (
                <div className="text-center py-2">
                  <Badge className="text-sm px-4 py-1">Proposta enviada ✓</Badge>
                  <p className="text-xs text-muted-foreground mt-2">Aguardando resposta do cliente</p>
                </div>
              ) : !showContra ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 h-12"
                      onClick={() => { stopAlert(); handleAceitar(selectedCorrida); }}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="h-5 w-5 mr-2" />Aceitar</>}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 h-12"
                      onClick={() => setShowContra(true)}
                      disabled={actionLoading}
                    >
                      <DollarSign className="h-5 w-5 mr-2" />
                      Proposta
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleRecusar(selectedCorrida.id)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Recusar corrida
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">R$</span>
                    <Input
                      type="number"
                      placeholder="Seu valor"
                      value={contraValor}
                      onChange={(e) => setContraValor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 h-10"
                      onClick={() => handleContraProposta(selectedCorrida)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10"
                      onClick={() => { setShowContra(false); setContraValor(""); }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* No rides available */}
      {isOnline && corridas.length === 0 && motoristaData?.status_kyc === "aprovado" && !selectedCorrida && !corridaAceita && (
        <div className="absolute bottom-3 left-4 right-4">
          <Card className="shadow-lg">
            <CardContent className="py-6 text-center">
              <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma corrida disponível no momento</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Accepted ride card with status progression */}
      {corridaAceita && (
        <div className="absolute bottom-3 left-4 right-4">
          <Card className="shadow-lg">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                {corridaAceita.cliente_foto ? (
                  <ZoomableAvatar
                    src={`${baseUrl}/storage/v1/object/public/profile-photos/${corridaAceita.cliente_foto}`}
                    alt="Cliente"
                  />
                ) : (
                  <ZoomableAvatar src={null} alt="Cliente" fallbackIcon={<User className="h-6 w-6 text-muted-foreground" />} />
                )}
                <div className="flex-1">
                  <p className="font-semibold">{titleCase(corridaAceita.cliente_nome)}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      {corridaAceita.corrida.status === "aceita" && "Corrida aceita"}
                      {corridaAceita.corrida.status === "a_caminho" && "Indo até o cliente"}
                      {corridaAceita.corrida.status === "chegou" && "Você chegou!"}
                      {corridaAceita.corrida.status === "carregando" && "Carregando itens..."}
                      {corridaAceita.corrida.status === "em_deslocamento" && "A caminho do destino"}
                    </p>
                    <Badge variant="outline" className="gap-1 text-xs">
                      {corridaAceita.forma_pagamento === "pix" ? <QrCode className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
                      {corridaAceita.forma_pagamento === "pix" ? "PIX" : "Dinheiro"}
                    </Badge>
                  </div>
                </div>
                <Badge className="ml-auto">{corridaAceita.corrida.status.replace("_", " ")}</Badge>
              </div>

              {/* Status progress bar */}
              <div className="flex gap-1">
                {["aceita", "a_caminho", "chegou", "em_deslocamento"].map((s, i) => (
                  <div
                    key={s}
                    className={`h-1.5 flex-1 rounded-full ${
                      ["aceita", "a_caminho", "chegou", "em_deslocamento"].indexOf(corridaAceita.corrida.status) >= i
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  />
                ))}
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex items-start gap-2">
                  <Navigation className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span className="line-clamp-1">{corridaAceita.corrida.origem_texto}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <span className="line-clamp-1">{corridaAceita.corrida.destino_texto}</span>
                </div>
              </div>

              {/* Items list - always visible during accepted ride */}
              {corridaAceita.corrida.itens && corridaAceita.corrida.itens.length > 0 && (
                <div className="border-t pt-2 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Package className="h-3 w-3" /> O que você vai levar
                  </p>
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {corridaAceita.corrida.itens.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>{item.qtd}x {item.item_nome}</span>
                        <span className="text-muted-foreground">R$ {Number(item.subtotal).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(corridaAceita.corrida as any).com_ajudante && (
                <div className="flex items-center gap-2 p-2 bg-accent rounded text-sm">
                  <Users className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium">Com ajudante</span>
                  <span className="ml-auto">+ R$ {Number((corridaAceita.corrida as any).preco_ajudante || 0).toFixed(2)}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {corridaAceita.corrida.distancia_km ? `${Number(corridaAceita.corrida.distancia_km).toFixed(1)} km` : ""}
                </span>
                <span className="font-bold text-primary">R$ {Number(corridaAceita.corrida.preco_total_estimado).toFixed(2)}</span>
                {user && (
                  <ChatDrawer
                    corridaId={corridaAceita.corrida.id}
                    currentUserId={user.id}
                    currentUserType="motorista"
                  />
                )}
              </div>

              {/* Navigation button - opens Waze or Google Maps */}
              {(() => {
                const nav = getNavDestination();
                return nav ? (
                  <Button
                    variant="outline"
                    className="w-full h-11 gap-2"
                    onClick={() => openNavigation(nav.lat, nav.lng)}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {nav.label}
                  </Button>
                ) : null;
              })()}

              {/* Cancel button - only before pickup code validation */}
              {["aceita", "a_caminho"].includes(corridaAceita.corrida.status) && (
                <Button variant="destructive" size="sm" className="w-full" onClick={handleCancelarCorridaMotorista} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4 mr-1" />Cancelar corrida</>}
                </Button>
              )}

              {/* Action buttons based on current status */}
              {corridaAceita.corrida.status === "aceita" && (
                <Button className="w-full h-12" onClick={() => handleUpdateStatus("a_caminho")} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Navigation className="h-5 w-5 mr-2" />Estou a caminho</>}
                </Button>
              )}
              {corridaAceita.corrida.status === "a_caminho" && (
                <Button className="w-full h-12" onClick={() => handleUpdateStatus("chegou")} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><MapPin className="h-5 w-5 mr-2" />Cheguei ao local</>}
                </Button>
              )}
              {/* At pickup: driver enters client's 4-digit code to confirm collection */}
              {corridaAceita.corrida.status === "chegou" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Lock className="h-4 w-4 text-primary" />
                    <span className="font-medium">Peça o código de coleta ao cliente:</span>
                  </div>
                  <div className="flex justify-center">
                    <InputOTP maxLength={4} value={codigoInput} onChange={setCodigoInput}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <Button className="w-full h-12" onClick={handleValidatePickupCode} disabled={actionLoading || codigoInput.length < 4}>
                    {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="h-5 w-5 mr-2" />Confirmar coleta</>}
                  </Button>
                </div>
              )}
              {/* At destination: driver enters client's delivery code to finalize */}
              {corridaAceita.corrida.status === "em_deslocamento" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Lock className="h-4 w-4 text-primary" />
                    <span className="font-medium">Peça o código de entrega ao cliente:</span>
                  </div>
                  <div className="flex justify-center">
                    <InputOTP maxLength={4} value={codigoInput} onChange={setCodigoInput}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <Button className="w-full h-12" onClick={handleValidateDeliveryCode} disabled={actionLoading || codigoInput.length < 4}>
                    {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Check className="h-5 w-5 mr-2" />Confirmar entrega</>}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
