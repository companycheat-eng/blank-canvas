import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Navigation, MapPin, Package, Clock, DollarSign, User, ChevronDown, ChevronUp, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "@/components/ui/sonner";

interface CorridaItem {
  id: string;
  item_nome: string;
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
  com_ajudante: boolean;
  preco_ajudante: number;
  status: string;
  created_at: string;
  motorista_nome: string | null;
  motorista_foto: string | null;
  itens: CorridaItem[];
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  buscando: { label: "Buscando", variant: "secondary" },
  aceita: { label: "Aceita", variant: "default" },
  a_caminho: { label: "A caminho", variant: "default" },
  chegou: { label: "Chegou", variant: "default" },
  carregando: { label: "Carregando", variant: "default" },
  em_deslocamento: { label: "Em deslocamento", variant: "default" },
  finalizada: { label: "Finalizada", variant: "outline" },
  cancelada: { label: "Cancelada", variant: "destructive" },
  contra_proposta: { label: "Contra-proposta", variant: "secondary" },
  recusada_cliente: { label: "Recusada", variant: "destructive" },
};

export default function ClienteHistorico() {
  const { user } = useAuth();
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || apikey;
      const headers = { apikey, Authorization: `Bearer ${token}` };

      // Get cliente id
      const cliRes = await fetch(`${baseUrl}/rest/v1/clientes?select=id&user_id=eq.${user.id}&limit=1`, { headers });
      const cliData = await cliRes.json();
      if (!cliData?.[0]) { setLoading(false); return; }

      const clienteId = cliData[0].id;

      // Get corridas with motorista info
      const res = await fetch(
        `${baseUrl}/rest/v1/corridas?select=id,origem_texto,destino_texto,distancia_km,duracao_min,preco_total_estimado,preco_itens,preco_km,com_ajudante,preco_ajudante,status,created_at,motoristas(nome,foto_url)&cliente_id=eq.${clienteId}&order=created_at.desc`,
        { headers }
      );
      const corridasData = await res.json();
      if (!Array.isArray(corridasData)) { setLoading(false); return; }

      // Get all items for these corridas
      const corridaIds = corridasData.map((c: any) => c.id);
      let itensMap: Record<string, CorridaItem[]> = {};

      if (corridaIds.length > 0) {
        const itensRes = await fetch(
          `${baseUrl}/rest/v1/corrida_itens?select=id,corrida_id,qtd,subtotal,itens_global(nome)&corrida_id=in.(${corridaIds.join(",")})`,
          { headers }
        );
        const itensData = await itensRes.json();
        if (Array.isArray(itensData)) {
          itensData.forEach((item: any) => {
            if (!itensMap[item.corrida_id]) itensMap[item.corrida_id] = [];
            itensMap[item.corrida_id].push({
              id: item.id,
              item_nome: item.itens_global?.nome || "Item",
              qtd: item.qtd,
              subtotal: item.subtotal,
            });
          });
        }
      }

      const storageUrl = `${baseUrl}/storage/v1/object/public/profile-photos`;

      setCorridas(
        corridasData.map((c: any) => ({
          id: c.id,
          origem_texto: c.origem_texto,
          destino_texto: c.destino_texto,
          distancia_km: c.distancia_km,
          duracao_min: c.duracao_min,
          preco_total_estimado: c.preco_total_estimado,
          preco_itens: c.preco_itens,
          preco_km: c.preco_km,
          com_ajudante: c.com_ajudante || false,
          preco_ajudante: c.preco_ajudante || 0,
          status: c.status,
          created_at: c.created_at,
          motorista_nome: c.motoristas?.nome || null,
          motorista_foto: c.motoristas?.foto_url ? `${storageUrl}/${c.motoristas.foto_url}` : null,
          itens: itensMap[c.id] || [],
        }))
      );
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return <div className="p-4 text-center text-sm text-muted-foreground animate-pulse">Carregando histórico...</div>;
  }

  if (corridas.length === 0) {
    return (
      <div className="p-4 text-center">
        <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Nenhuma corrida realizada ainda</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-xl font-bold">Histórico de corridas</h2>
      {corridas.map((c) => {
        const expanded = expandedId === c.id;
        const st = statusLabels[c.status] || { label: c.status, variant: "secondary" as const };
        return (
          <Card key={c.id} className="shadow-sm">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {format(new Date(c.created_at), "dd/MM/yyyy HH:mm")}
                </span>
                <Badge variant={st.variant}>{st.label}</Badge>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex items-start gap-2">
                  <Navigation className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span className="line-clamp-1">{c.origem_texto}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <span className="line-clamp-1">{c.destino_texto}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {c.distancia_km ? `${Number(c.distancia_km).toFixed(1)} km` : ""}
                  {c.duracao_min ? ` · ${c.duracao_min} min` : ""}
                </span>
                <span className="font-bold text-primary">R$ {Number(c.preco_total_estimado).toFixed(2)}</span>
              </div>

              {/* Cancel button for active rides */}
              {["buscando", "contra_proposta"].includes(c.status) && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
                    const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
                    const session = await supabase.auth.getSession();
                    const token = session.data.session?.access_token || apikey;
                    const res = await fetch(`${baseUrl}/rest/v1/corridas?id=eq.${c.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json", apikey, Authorization: `Bearer ${token}`, Prefer: "return=minimal" },
                      body: JSON.stringify({ status: "cancelada" }),
                    });
                    if (res.ok) {
                      setCorridas((prev) => prev.map((cr) => cr.id === c.id ? { ...cr, status: "cancelada" } : cr));
                      toast.success("Corrida cancelada");
                    } else {
                      toast.error("Erro ao cancelar corrida");
                    }
                  }}
                >
                  Cancelar corrida
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setExpandedId(expanded ? null : c.id)}
              >
                {expanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                {expanded ? "Menos detalhes" : "Mais detalhes"}
              </Button>

              {expanded && (
                <div className="space-y-3 pt-2 border-t">
                  {/* Motorista */}
                  {c.motorista_nome && (
                    <div className="flex items-center gap-3">
                      {c.motorista_foto ? (
                        <img src={c.motorista_foto} alt="Motorista" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                          <User className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{c.motorista_nome}</p>
                        <p className="text-xs text-muted-foreground">Motorista</p>
                      </div>
                    </div>
                  )}

                  {/* Itens */}
                  {c.itens.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <Package className="h-3 w-3" /> Itens
                      </p>
                      {c.itens.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span>{item.qtd}x {item.item_nome}</span>
                          <span>R$ {Number(item.subtotal).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Preços */}
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Itens</span>
                      <span>R$ {Number(c.preco_itens).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Distância</span>
                      <span>R$ {Number(c.preco_km).toFixed(2)}</span>
                    </div>
                    {c.com_ajudante && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ajudante</span>
                        <span>R$ {Number(c.preco_ajudante).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold border-t pt-1">
                      <span>Total</span>
                      <span>R$ {Number(c.preco_total_estimado).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
