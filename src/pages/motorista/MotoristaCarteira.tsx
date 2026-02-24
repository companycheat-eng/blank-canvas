import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Wallet, ArrowUpCircle, ArrowDownCircle, Plus, Loader2, Clock, Copy, Check, QrCode, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";

interface LedgerEntry {
  id: string;
  tipo: "credito" | "debito";
  valor: number;
  motivo: string;
  created_at: string;
}

interface Recarga {
  id: string;
  valor_brl: number;
  creditos: number;
  status: string;
  created_at: string;
  pix_qr_code: string | null;
  pix_copia_cola: string | null;
  mp_payment_id: string | null;
}

export default function MotoristaCarteira() {
  const { user } = useAuth();
  const [saldo, setSaldo] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [recargas, setRecargas] = useState<Recarga[]>([]);
  const [motoristaId, setMotoristaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recargaValor, setRecargaValor] = useState("");
  const [showRecarga, setShowRecarga] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pixData, setPixData] = useState<{ qr_code_base64: string; copia_cola: string; recarga_id: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const getHeaders = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token || apikey;
    return { apikey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  };

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const h = await getHeaders();

    const mRes = await fetch(
      `${baseUrl}/rest/v1/motoristas?select=id,saldo_creditos&user_id=eq.${user.id}&limit=1`,
      { headers: h }
    );
    const mData = await mRes.json();
    if (!mData?.[0]) { setLoading(false); return; }

    const mid = mData[0].id;
    setMotoristaId(mid);
    setSaldo(mData[0].saldo_creditos);

    const [ledgerRes, recargaRes] = await Promise.all([
      fetch(`${baseUrl}/rest/v1/wallet_ledger?select=id,tipo,valor,motivo,created_at&motorista_id=eq.${mid}&order=created_at.desc&limit=50`, { headers: h }),
      fetch(`${baseUrl}/rest/v1/recargas?select=id,valor_brl,creditos,status,created_at,pix_qr_code,pix_copia_cola,mp_payment_id&motorista_id=eq.${mid}&order=created_at.desc&limit=20`, { headers: h }),
    ]);

    const ledgerData = await ledgerRes.json();
    const recargaData = await recargaRes.json();

    if (Array.isArray(ledgerData)) setLedger(ledgerData);
    if (Array.isArray(recargaData)) setRecargas(recargaData);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  // Poll for payment status when PIX is active
  useEffect(() => {
    if (!pixData) return;
    const interval = setInterval(async () => {
      const h = await getHeaders();
      const res = await fetch(
        `${baseUrl}/rest/v1/recargas?select=status,id&id=eq.${pixData.recarga_id}&limit=1`,
        { headers: h }
      );
      const data = await res.json();
      if (data?.[0]?.status === "aprovada") {
        toast.success("Pagamento confirmado! Créditos adicionados.");
        setPixData(null);
        loadData();
      } else if (data?.[0]?.status === "cancelada") {
        toast.error("Pagamento cancelado ou expirado.");
        setPixData(null);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [pixData]);

  const handleSolicitarRecarga = async () => {
    const valor = parseFloat(recargaValor);
    if (isNaN(valor) || valor < 5) {
      toast.error("Valor mínimo: R$ 5,00");
      return;
    }
    if (!motoristaId) return;
    setSubmitting(true);

    try {
      const h = await getHeaders();
      // Create recarga record
      const res = await fetch(`${baseUrl}/rest/v1/recargas`, {
        method: "POST",
        headers: { ...h, Prefer: "return=representation" },
        body: JSON.stringify({
          motorista_id: motoristaId,
          valor_brl: valor,
          creditos: valor,
          status: "pendente",
        }),
      });
      if (!res.ok) throw new Error("Erro ao solicitar recarga");
      const [newRecarga] = await res.json();

      // Create PIX payment
      const pixRes = await fetch(`${baseUrl}/functions/v1/create-pix-payment`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ valor, recarga_id: newRecarga.id }),
      });
      const pixResult = await pixRes.json();

      if (!pixRes.ok) {
        toast.error(pixResult.error || "Erro ao gerar PIX");
        setRecargas((prev) => [newRecarga, ...prev]);
        setShowRecarga(false);
        return;
      }

      setPixData({
        qr_code_base64: pixResult.qr_code_base64,
        copia_cola: pixResult.copia_cola,
        recarga_id: newRecarga.id,
      });
      setRecargas((prev) => [{ ...newRecarga, ...pixResult }, ...prev]);
      setRecargaValor("");
      setShowRecarga(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCola = () => {
    if (pixData?.copia_cola) {
      navigator.clipboard.writeText(pixData.copia_cola);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const statusColor = (s: string) => {
    if (s === "aprovada") return "bg-green-500";
    if (s === "cancelada") return "bg-destructive";
    return "bg-yellow-500";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Balance Card */}
      <Card>
        <CardContent className="py-6 text-center">
          <Wallet className="h-10 w-10 text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Saldo disponível</p>
          <p className="text-3xl font-bold text-primary">
            R$ {saldo !== null ? Number(saldo).toFixed(2) : "---"}
          </p>
          {!pixData && (
            <Button className="mt-4" onClick={() => setShowRecarga(!showRecarga)}>
              <Plus className="h-4 w-4 mr-2" /> Recarregar via PIX
            </Button>
          )}
        </CardContent>
      </Card>

      {/* PIX QR Code display */}
      {pixData && (
        <Card className="border-primary">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                <p className="font-semibold text-sm">Pague com PIX</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPixData(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {pixData.qr_code_base64 && (
              <div className="flex justify-center">
                <img
                  src={`data:image/png;base64,${pixData.qr_code_base64}`}
                  alt="QR Code PIX"
                  className="w-48 h-48 rounded-lg"
                />
              </div>
            )}
            {pixData.copia_cola && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">Ou copie o código PIX:</p>
                <div className="flex gap-2">
                  <Input
                    value={pixData.copia_cola}
                    readOnly
                    className="text-xs font-mono"
                  />
                  <Button size="sm" variant="outline" onClick={handleCopyCola}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Aguardando pagamento...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recarga form */}
      {showRecarga && !pixData && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <p className="text-sm font-medium">Valor da recarga (R$)</p>
            <div className="flex gap-2">
              {[10, 20, 50, 100].map((v) => (
                <Button
                  key={v}
                  variant={recargaValor === String(v) ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRecargaValor(String(v))}
                >
                  {v}
                </Button>
              ))}
            </div>
            <Input
              type="number"
              placeholder="Outro valor"
              value={recargaValor}
              onChange={(e) => setRecargaValor(e.target.value)}
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSolicitarRecarga} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar PIX"}
              </Button>
              <Button variant="outline" onClick={() => setShowRecarga(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending recharges */}
      {recargas.filter((r) => r.status === "pendente").length > 0 && !pixData && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" /> Recargas pendentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recargas
              .filter((r) => r.status === "pendente")
              .map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm p-2 bg-secondary rounded">
                  <span>R$ {Number(r.valor_brl).toFixed(2)}</span>
                  <Badge className={statusColor(r.status) + " text-white"}>Pendente</Badge>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Ledger */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Extrato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação</p>
          ) : (
            ledger.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-2 border-b last:border-0">
                <div className="flex items-center gap-2">
                  {entry.tipo === "credito" ? (
                    <ArrowUpCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <ArrowDownCircle className="h-4 w-4 text-destructive" />
                  )}
                  <div>
                    <p className="text-sm">{entry.motivo}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-medium ${entry.tipo === "credito" ? "text-green-500" : "text-destructive"}`}>
                  {entry.tipo === "credito" ? "+" : "-"}R$ {Number(entry.valor).toFixed(2)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
