import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, Wallet } from "lucide-react";

interface FaturamentoData {
  comissoes: number;
  recargas: number;
}

export default function AdminFaturamento() {
  const [periodo, setPeriodo] = useState<"semana" | "mes" | "ano">("mes");
  const [data, setData] = useState<FaturamentoData>({ comissoes: 0, recargas: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const now = new Date();
      let desde: Date;

      if (periodo === "semana") {
        desde = new Date(now);
        desde.setDate(now.getDate() - 7);
      } else if (periodo === "mes") {
        desde = new Date(now.getFullYear(), now.getMonth(), 1);
      } else {
        desde = new Date(now.getFullYear(), 0, 1);
      }

      const desdeISO = desde.toISOString();

      const [ledgerRes, recargasRes] = await Promise.all([
        supabase
          .from("wallet_ledger")
          .select("valor, tipo, motivo")
          .gte("created_at", desdeISO),
        supabase
          .from("recargas")
          .select("valor_brl")
          .eq("status", "aprovada")
          .gte("created_at", desdeISO),
      ]);

      // Receita líquida = débitos (taxas) - estornos (créditos com motivo de estorno)
      const ledgerData = ledgerRes.data || [];
      const totalDebitos = ledgerData
        .filter((r: any) => r.tipo === "debito")
        .reduce((sum: number, r: any) => sum + Number(r.valor), 0);
      const totalEstornos = ledgerData
        .filter((r: any) => r.tipo === "credito" && String(r.motivo || "").toLowerCase().includes("estorno"))
        .reduce((sum: number, r: any) => sum + Number(r.valor), 0);
      const comissoes = Math.max(0, totalDebitos - totalEstornos);
      const recargas = (recargasRes.data || []).reduce((sum, r) => sum + Number(r.valor_brl), 0);

      setData({ comissoes, recargas });
      setLoading(false);
    };

    load();
  }, [periodo]);

  const formatBRL = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6 py-4">
      <h2 className="text-2xl font-bold">Faturamento</h2>

      <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="mes">Mês</TabsTrigger>
          <TabsTrigger value="ano">Ano</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground animate-pulse">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Receita de Comissões
              </CardTitle>
              <TrendingUp className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{formatBRL(data.comissoes)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Taxa cobrada dos motoristas por corrida
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Recargas dos Motoristas
              </CardTitle>
              <Wallet className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-accent">{formatBRL(data.recargas)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Total carregado via PIX
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Geral
              </CardTitle>
              <DollarSign className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatBRL(data.comissoes + data.recargas)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Comissões + Recargas no período
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
