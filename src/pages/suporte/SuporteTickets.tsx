import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Clock } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Ticket {
  id: string;
  user_id: string;
  user_tipo: string;
  assunto: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function SuporteTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("aberto");
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("suporte_tickets")
        .select("*")
        .eq("status", filtro)
        .order("updated_at", { ascending: false });
      setTickets((data as Ticket[]) || []);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel("suporte-tickets-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "suporte_tickets" }, () => {
        load();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [filtro]);

  const statusColor = (s: string) => {
    if (s === "aberto") return "destructive";
    if (s === "em_andamento") return "default";
    return "secondary";
  };

  const formatDate = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4 py-4">
      <h2 className="text-2xl font-bold">Tickets de Suporte</h2>

      <Tabs value={filtro} onValueChange={setFiltro}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="aberto">Abertos</TabsTrigger>
          <TabsTrigger value="em_andamento">Em andamento</TabsTrigger>
          <TabsTrigger value="fechado">Fechados</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <p className="text-center text-muted-foreground py-8 animate-pulse">Carregando...</p>
      ) : tickets.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhum ticket {filtro}.</p>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/suporte/${t.id}`)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{t.assunto}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">{t.user_tipo}</Badge>
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(t.updated_at)}</span>
                    </div>
                  </div>
                  <Badge variant={statusColor(t.status) as any}>{t.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
