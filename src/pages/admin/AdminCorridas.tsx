import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Search, ChevronLeft, ChevronRight, MapPin, Navigation, Clock, DollarSign, User, Truck, Package } from "lucide-react";
import { format } from "date-fns";

interface Bairro {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
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
  created_at: string;
  updated_at: string;
  bairro_id: string;
  bairro_nome: string;
  bairro_cidade: string;
  cliente_nome: string;
  motorista_nome: string | null;
  codigo_coleta: string | null;
  codigo_entrega: string | null;
  contra_proposta_valor: number | null;
  taxa_creditos_debitada: number | null;
  cancelado_por: string | null;
  forma_pagamento: string;
  com_ajudante: boolean;
  preco_ajudante: number;
}

const STATUS_COLORS: Record<string, string> = {
  buscando: "bg-yellow-500 text-white",
  aceita: "bg-blue-500 text-white",
  contra_proposta: "bg-orange-500 text-white",
  a_caminho: "bg-blue-600 text-white",
  chegou: "bg-indigo-500 text-white",
  carregando: "bg-purple-500 text-white",
  em_deslocamento: "bg-primary text-primary-foreground",
  finalizada: "bg-success text-success-foreground",
  cancelada: "bg-destructive text-destructive-foreground",
  recusada_cliente: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  buscando: "Buscando",
  aceita: "Aceita",
  contra_proposta: "Contra-proposta",
  a_caminho: "A caminho",
  chegou: "Chegou",
  carregando: "Carregando",
  em_deslocamento: "Em deslocamento",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
  recusada_cliente: "Recusada",
};

const ACTIVE_STATUSES = ["buscando", "aceita", "contra_proposta", "a_caminho", "chegou", "carregando", "em_deslocamento"];

export default function AdminCorridas() {
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [tab, setTab] = useState<"ativas" | "historico">("ativas");
  const [filterBairroId, setFilterBairroId] = useState<string>("todos");
  const [filterCidade, setFilterCidade] = useState<string>("todas");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Corrida | null>(null);
  const perPage = 10;

  const load = async () => {
    const [{ data: corridasData }, { data: bairrosData }] = await Promise.all([
      supabase
        .from("corridas")
        .select("*, clientes(nome), motoristas(nome), bairros(nome, cidade)")
        .order("created_at", { ascending: false }),
      supabase.from("bairros").select("id, nome, cidade, estado").eq("ativo", true).order("nome"),
    ]);

    setBairros((bairrosData as Bairro[]) || []);

    setCorridas(
      (corridasData || []).map((c: any) => ({
        ...c,
        bairro_nome: c.bairros?.nome || "—",
        bairro_cidade: c.bairros?.cidade || "—",
        cliente_nome: c.clientes?.nome || "—",
        motorista_nome: c.motoristas?.nome || null,
        com_ajudante: c.com_ajudante || false,
        preco_ajudante: c.preco_ajudante || 0,
      }))
    );
  };

  useEffect(() => { load(); }, []);

  // Realtime for active rides
  useEffect(() => {
    const channel = supabase
      .channel("admin-corridas-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "corridas" }, () => {
        load();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const cidades = [...new Set(bairros.map((b) => b.cidade))].sort();

  const filtered = corridas.filter((c) => {
    // Tab filter
    if (tab === "ativas" && !ACTIVE_STATUSES.includes(c.status)) return false;
    if (tab === "historico" && ACTIVE_STATUSES.includes(c.status)) return false;

    // Bairro filter
    if (filterBairroId !== "todos" && c.bairro_id !== filterBairroId) return false;

    // Cidade filter
    if (filterCidade !== "todas" && c.bairro_cidade !== filterCidade) return false;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.cliente_nome.toLowerCase().includes(q) ||
        (c.motorista_nome || "").toLowerCase().includes(q) ||
        c.origem_texto.toLowerCase().includes(q) ||
        c.destino_texto.toLowerCase().includes(q) ||
        c.bairro_nome.toLowerCase().includes(q) ||
        c.id.includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Corridas</h2>
        <Badge variant="secondary">{filtered.length} corrida{filtered.length !== 1 ? "s" : ""}</Badge>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as any); setPage(1); }}>
        <TabsList className="w-full">
          <TabsTrigger value="ativas" className="flex-1">
            Ativas ({corridas.filter((c) => ACTIVE_STATUSES.includes(c.status)).length})
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex-1">
            Histórico ({corridas.filter((c) => !ACTIVE_STATUSES.includes(c.status)).length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={filterCidade} onValueChange={(v) => { setFilterCidade(v); setFilterBairroId("todos"); setPage(1); }}>
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Cidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas cidades</SelectItem>
            {cidades.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterBairroId} onValueChange={(v) => { setFilterBairroId(v); setPage(1); }}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Bairro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos bairros</SelectItem>
            {bairros
              .filter((b) => filterCidade === "todas" || b.cidade === filterCidade)
              .map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
              ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, motorista, endereço..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Nenhuma corrida encontrada.</p>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((c) => (
              <Card key={c.id} className="shadow-sm cursor-pointer hover:ring-2 ring-primary/30 transition-all" onClick={() => setSelected(c)}>
                <CardContent className="py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Navigation className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <span className="line-clamp-1">{c.origem_texto}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3.5 w-3.5 text-destructive shrink-0" />
                        <span className="line-clamp-1">{c.destino_texto}</span>
                      </div>
                    </div>
                    <Badge className={STATUS_COLORS[c.status] || ""}>
                      {STATUS_LABELS[c.status] || c.status}
                      {c.status === "cancelada" && c.cancelado_por && ` (${c.cancelado_por})`}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" /> {c.cliente_nome}
                    </span>
                    {c.motorista_nome && (
                      <span className="flex items-center gap-1">
                        <Truck className="h-3 w-3" /> {c.motorista_nome}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> R$ {Number(c.preco_total_estimado).toFixed(2)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {format(new Date(c.created_at), "dd/MM HH:mm")}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {c.bairro_nome}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">{currentPage} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Corrida</DialogTitle>
            <DialogDescription>
              {selected && format(new Date(selected.created_at), "dd/MM/yyyy 'às' HH:mm")}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <Badge className={STATUS_COLORS[selected.status] || ""}>
                {STATUS_LABELS[selected.status] || selected.status}
                {selected.status === "cancelada" && selected.cancelado_por && ` (pelo ${selected.cancelado_por})`}
              </Badge>

              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <Navigation className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>{selected.origem_texto}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <span>{selected.destino_texto}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Cliente:</span> {selected.cliente_nome}</div>
                <div><span className="text-muted-foreground">Motorista:</span> {selected.motorista_nome || "—"}</div>
                <div><span className="text-muted-foreground">Bairro:</span> {selected.bairro_nome}</div>
                <div><span className="text-muted-foreground">Cidade:</span> {selected.bairro_cidade}</div>
                <div><span className="text-muted-foreground">Distância:</span> {selected.distancia_km ? `${Number(selected.distancia_km).toFixed(1)} km` : "—"}</div>
                <div><span className="text-muted-foreground">Duração:</span> {selected.duracao_min ? `${selected.duracao_min} min` : "—"}</div>
              </div>

              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preço itens:</span>
                  <span>R$ {Number(selected.preco_itens).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preço km:</span>
                  <span>R$ {Number(selected.preco_km).toFixed(2)}</span>
                </div>
                {selected.com_ajudante && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ajudante:</span>
                    <span>R$ {Number(selected.preco_ajudante).toFixed(2)}</span>
                  </div>
                )}
                {selected.contra_proposta_valor && (
                  <div className="flex justify-between text-orange-600">
                    <span>Contra-proposta:</span>
                    <span>R$ {Number(selected.contra_proposta_valor).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>R$ {Number(selected.preco_total_estimado).toFixed(2)}</span>
                </div>
                {selected.taxa_creditos_debitada && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Taxa debitada:</span>
                    <span>R$ {Number(selected.taxa_creditos_debitada).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {(selected.codigo_coleta || selected.codigo_entrega) && (
                <div className="border-t pt-3 grid grid-cols-2 gap-2 text-sm">
                  {selected.codigo_coleta && (
                    <div><span className="text-muted-foreground">Código coleta:</span> <span className="font-mono font-bold">{selected.codigo_coleta}</span></div>
                  )}
                  {selected.codigo_entrega && (
                    <div><span className="text-muted-foreground">Código entrega:</span> <span className="font-mono font-bold">{selected.codigo_entrega}</span></div>
                  )}
                </div>
              )}

              <div className="border-t pt-3 text-xs text-muted-foreground">
                <p>Criada: {format(new Date(selected.created_at), "dd/MM/yyyy HH:mm:ss")}</p>
                <p>Atualizada: {format(new Date(selected.updated_at), "dd/MM/yyyy HH:mm:ss")}</p>
                <p className="font-mono mt-1">ID: {selected.id}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
