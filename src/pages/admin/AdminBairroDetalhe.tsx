import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { ArrowLeft, MapPin, Package, Plus, Pencil, Settings, Save, CreditCard, Clock, Trash2, Key } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Bairro {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  ativo: boolean;
  lat: number | null;
  lng: number | null;
}

interface ItemGlobal {
  id: string;
  nome: string;
  preco_base: number;
  ativo: boolean;
}

interface ItemOverride {
  id: string;
  item_id: string;
  preco_override: number;
  ativo: boolean;
}

interface ConfigBairro {
  id: string;
  key: string;
  value: any;
}

const CONFIG_LABELS: Record<string, string> = {
  taxa_percentual: "Taxa % cobrada do motorista",
  valor_por_km: "Valor por km (R$)",
  raio_maximo_km: "Raio máximo de atendimento (km)",
  contra_proposta_limites: "Limites de contra-proposta (%)",
  ajudante_preco: "Preço do ajudante (R$)",
};

const MP_CONFIG_KEYS = ["mp_access_token", "mp_webhook_secret", "mp_api_base_url", "mp_app_base_url"];
const MP_CONFIG_LABELS: Record<string, { label: string; placeholder: string; type?: string }> = {
  mp_access_token: { label: "Access Token", placeholder: "APP_USR-...", type: "password" },
  mp_webhook_secret: { label: "Webhook Secret", placeholder: "Chave secreta do webhook", type: "password" },
  mp_api_base_url: { label: "URL API MP Base", placeholder: "https://api.mercadopago.com" },
  mp_app_base_url: { label: "App Base URL (webhook)", placeholder: "https://xivglpmjbwzlojlafxjh.supabase.co/functions/v1/mp-webhook" },
};

export default function AdminBairroDetalhe() {
  const { bairroId } = useParams<{ bairroId: string }>();
  const navigate = useNavigate();

  const [bairro, setBairro] = useState<Bairro | null>(null);
  const [itensGlobal, setItensGlobal] = useState<ItemGlobal[]>([]);
  const [overrides, setOverrides] = useState<ItemOverride[]>([]);
  const [configs, setConfigs] = useState<ConfigBairro[]>([]);

  // Edit bairro
  const [editingBairro, setEditingBairro] = useState(false);
  const [editNome, setEditNome] = useState("");
  const [editCidade, setEditCidade] = useState("");
  const [editEstado, setEditEstado] = useState("");

  // Override form
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideItemId, setOverrideItemId] = useState("");
  const [overridePreco, setOverridePreco] = useState("");
  const [editingOverride, setEditingOverride] = useState<ItemOverride | null>(null);

  // Config form
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [configKey, setConfigKey] = useState("");
  const [configValor, setConfigValor] = useState("");
  const [configEdits, setConfigEdits] = useState<Record<string, string>>({});
  const [mpEdits, setMpEdits] = useState<Record<string, string>>({});
  const [savingMp, setSavingMp] = useState(false);
  const [mapsApiKey, setMapsApiKey] = useState("");
  const [savingMapsKey, setSavingMapsKey] = useState(false);

  // Surge pricing
  interface FaixaHorario {
    inicio: string;
    fim: string;
    multiplicador: number;
  }
  const [faixas, setFaixas] = useState<FaixaHorario[]>([]);
  const [savingSurge, setSavingSurge] = useState(false);

  const load = async () => {
    if (!bairroId) return;

    const [{ data: bairroData }, { data: itensData }, { data: overridesData }, { data: configsData }] = await Promise.all([
      supabase.from("bairros").select("*").eq("id", bairroId).single(),
      supabase.from("itens_global").select("*").eq("ativo", true).order("nome"),
      supabase.from("itens_bairro_override").select("*").eq("bairro_id", bairroId),
      supabase.from("config_bairro").select("*").eq("bairro_id", bairroId),
    ]);

    if (bairroData) {
      setBairro(bairroData as Bairro);
      setEditNome(bairroData.nome);
      setEditCidade(bairroData.cidade);
      setEditEstado(bairroData.estado);
    }
    setItensGlobal((itensData as ItemGlobal[]) || []);
    setOverrides((overridesData as ItemOverride[]) || []);
    const cfgs = (configsData || []) as unknown as ConfigBairro[];
    setConfigs(cfgs);
    const edits: Record<string, string> = {};
    const mpE: Record<string, string> = {};
    cfgs.forEach((c) => {
      if (MP_CONFIG_KEYS.includes(c.key)) {
        mpE[c.key] = typeof c.value === "string" ? c.value : (c.value?.valor ?? "");
      } else if (c.key === "google_maps_api_key") {
        setMapsApiKey(typeof c.value === "string" ? c.value : (c.value?.valor ?? ""));
      } else if (c.key === "multiplicador_horario") {
        // Parse surge pricing faixas
        try {
          const val = typeof c.value === "string" ? JSON.parse(c.value) : c.value;
          if (Array.isArray(val?.faixas)) setFaixas(val.faixas);
          else if (Array.isArray(val)) setFaixas(val);
        } catch { setFaixas([]); }
      } else {
        edits[c.key] = String(c.value?.valor ?? "");
      }
    });
    setConfigEdits(edits);
    setMpEdits(mpE);
  };

  useEffect(() => { load(); }, [bairroId]);

  const saveBairro = async () => {
    if (!bairro) return;
    const { error } = await supabase.from("bairros")
      .update({ nome: editNome.trim(), cidade: editCidade.trim(), estado: editEstado.trim().toUpperCase() })
      .eq("id", bairro.id);
    if (error) toast.error(error.message);
    else { toast.success("Bairro atualizado!"); setEditingBairro(false); load(); }
  };

  const getItemNome = (itemId: string) => itensGlobal.find((i) => i.id === itemId)?.nome || "—";
  const getItemPrecoBase = (itemId: string) => itensGlobal.find((i) => i.id === itemId)?.preco_base || 0;

  const openOverrideCreate = () => {
    setEditingOverride(null);
    setOverrideItemId("");
    setOverridePreco("");
    setShowOverrideForm(true);
  };

  const openOverrideEdit = (o: ItemOverride) => {
    setEditingOverride(o);
    setOverrideItemId(o.item_id);
    setOverridePreco(String(o.preco_override));
    setShowOverrideForm(true);
  };

  const saveOverride = async () => {
    if (!bairroId || !overrideItemId || !overridePreco) { toast.error("Preencha todos os campos"); return; }
    const preco = parseFloat(overridePreco);

    if (editingOverride) {
      const { error } = await supabase.from("itens_bairro_override")
        .update({ preco_override: preco, item_id: overrideItemId })
        .eq("id", editingOverride.id);
      if (error) toast.error(error.message);
      else { toast.success("Preço atualizado!"); setShowOverrideForm(false); load(); }
    } else {
      const { error } = await supabase.from("itens_bairro_override")
        .insert({ bairro_id: bairroId, item_id: overrideItemId, preco_override: preco });
      if (error) toast.error(error.message);
      else { toast.success("Preço personalizado criado!"); setShowOverrideForm(false); load(); }
    }
  };

  const saveConfig = async (key: string) => {
    if (!bairroId) return;
    const val = parseFloat(configEdits[key]);
    if (isNaN(val)) { toast.error("Valor inválido"); return; }
    const existing = configs.find((c) => c.key === key);
    if (existing) {
      const { error } = await supabase.from("config_bairro").update({ value: { valor: val } }).eq("id", existing.id);
      if (error) toast.error(error.message);
      else { toast.success("Configuração salva!"); load(); }
    }
  };

  const addConfig = async () => {
    if (!bairroId || !configKey.trim() || !configValor) { toast.error("Preencha todos os campos"); return; }
    const val = parseFloat(configValor);
    if (isNaN(val)) { toast.error("Valor inválido"); return; }
    const { error } = await supabase.from("config_bairro")
      .insert({ bairro_id: bairroId, key: configKey.trim(), value: { valor: val } });
    if (error) toast.error(error.message);
    else { toast.success("Configuração criada!"); setShowConfigForm(false); setConfigKey(""); setConfigValor(""); load(); }
  };

  const saveMpConfig = async () => {
    if (!bairroId) return;
    setSavingMp(true);
    try {
      for (const key of MP_CONFIG_KEYS) {
        const val = (mpEdits[key] || "").trim();
        if (!val) continue;
        const existing = configs.find((c) => c.key === key);
        if (existing) {
          await supabase.from("config_bairro").update({ value: val }).eq("id", existing.id);
        } else {
          await supabase.from("config_bairro").insert({ bairro_id: bairroId, key, value: val });
        }
      }
      toast.success("Configurações MercadoPago salvas!");
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingMp(false);
    }
  };

  // Items not yet overridden
  const saveSurge = async () => {
    if (!bairroId) return;
    // Validate faixas
    for (const f of faixas) {
      if (!f.inicio || !f.fim || f.multiplicador < 1) {
        toast.error("Preencha todas as faixas corretamente (multiplicador ≥ 1.0)");
        return;
      }
    }
    setSavingSurge(true);
    try {
      const existing = configs.find((c) => c.key === "multiplicador_horario");
      const value = { faixas } as any;
      if (existing) {
        await supabase.from("config_bairro").update({ value }).eq("id", existing.id);
      } else {
        await (supabase.from("config_bairro") as any).insert({ bairro_id: bairroId, key: "multiplicador_horario", value });
      }
      toast.success("Faixas de horário salvas!");
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingSurge(false);
    }
  };

  const availableItems = itensGlobal.filter((i) => !overrides.some((o) => o.item_id === i.id) || editingOverride);

  if (!bairro) return <p className="text-muted-foreground p-4">Carregando...</p>;

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/bairros")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{bairro.nome}</h2>
          <p className="text-sm text-muted-foreground">{bairro.cidade} - {bairro.estado}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditingBairro(true)}>
          <Pencil className="h-4 w-4 mr-1" /> Editar
        </Button>
      </div>

      {/* Coordenadas */}
      {bairro.lat && bairro.lng && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" /> {bairro.lat.toFixed(4)}, {bairro.lng.toFixed(4)}
        </p>
      )}

      {/* Preços personalizados */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Preços Personalizados
          </h3>
          <Button size="sm" onClick={openOverrideCreate}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        </div>

        {overrides.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum preço personalizado. Os preços globais serão usados.</p>
        ) : (
          <div className="space-y-2">
            {overrides.map((o) => (
              <Card key={o.id} className="shadow-sm">
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-sm">{getItemNome(o.item_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      Global: R$ {Number(getItemPrecoBase(o.item_id)).toFixed(2)} → Bairro: R$ {Number(o.preco_override).toFixed(2)}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => openOverrideEdit(o)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Configurações do bairro */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" /> Configurações do Bairro
          </h3>
          <Button size="sm" onClick={() => setShowConfigForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova
          </Button>
        </div>

        {configs.filter((c) => !MP_CONFIG_KEYS.includes(c.key) && c.key !== "google_maps_api_key" && c.key !== "multiplicador_horario").length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma configuração específica. As configurações globais serão usadas.</p>
        ) : (
          <div className="space-y-2">
            {configs.filter((c) => !MP_CONFIG_KEYS.includes(c.key) && c.key !== "google_maps_api_key" && c.key !== "multiplicador_horario").map((c) => (
              <Card key={c.id} className="shadow-sm">
                <CardContent className="py-3 space-y-2">
                  <p className="font-medium text-sm">{CONFIG_LABELS[c.key] || c.key}</p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={configEdits[c.key] || ""}
                      onChange={(e) => setConfigEdits({ ...configEdits, [c.key]: e.target.value })}
                      className="flex-1"
                    />
                    <Button size="sm" onClick={() => saveConfig(c.key)}>
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* MercadoPago Config */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <CreditCard className="h-5 w-5 text-primary" /> Gateway de Pagamento (MercadoPago)
        </h3>
        <Card className="shadow-sm">
          <CardContent className="py-4 space-y-4">
            {MP_CONFIG_KEYS.map((key) => {
              const cfg = MP_CONFIG_LABELS[key];
              return (
                <div key={key} className="space-y-1">
                  <Label className="text-sm">{cfg.label}</Label>
                  <Input
                    type={cfg.type || "text"}
                    placeholder={cfg.placeholder}
                    value={mpEdits[key] || ""}
                    onChange={(e) => setMpEdits({ ...mpEdits, [key]: e.target.value })}
                  />
                </div>
              );
            })}
            <Button className="w-full" onClick={saveMpConfig} disabled={savingMp}>
              {savingMp ? "Salvando..." : <><Save className="h-4 w-4 mr-2" />Salvar configurações MercadoPago</>}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Google Maps API Key do Bairro */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Key className="h-5 w-5 text-primary" /> Google Maps API Key
        </h3>
        <Card className="shadow-sm">
          <CardContent className="py-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Chave de API do Google Maps específica para este bairro. Se não configurada, a chave global será usada.
            </p>
            <div className="space-y-1">
              <Label className="text-sm">API Key</Label>
              <Input
                type="password"
                placeholder="AIza... (deixe vazio para usar global)"
                value={mapsApiKey}
                onChange={(e) => setMapsApiKey(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={async () => {
              if (!bairroId) return;
              setSavingMapsKey(true);
              try {
                const existing = configs.find(c => c.key === "google_maps_api_key");
                const val = mapsApiKey.trim();
                if (!val && existing) {
                  // Remove config to fallback to global
                  await supabase.from("config_bairro").delete().eq("id", existing.id);
                  toast.success("Chave removida, será usada a global");
                } else if (val) {
                  if (existing) {
                    await supabase.from("config_bairro").update({ value: val }).eq("id", existing.id);
                  } else {
                    await supabase.from("config_bairro").insert({ bairro_id: bairroId, key: "google_maps_api_key", value: val });
                  }
                  toast.success("API Key salva para este bairro!");
                }
                load();
              } catch (err: any) {
                toast.error(err.message);
              } finally {
                setSavingMapsKey(false);
              }
            }} disabled={savingMapsKey}>
              {savingMapsKey ? "Salvando..." : <><Save className="h-4 w-4 mr-2" />Salvar API Key</>}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Clock className="h-5 w-5 text-primary" /> Acréscimo Dinâmico (por horário)
        </h3>
        <Card className="shadow-sm">
          <CardContent className="py-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Defina faixas de horário com multiplicador sobre o valor por km. Ex: 1.5x = 50% a mais no km.
            </p>
            {faixas.map((f, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Início</Label>
                  <Input
                    type="time"
                    value={f.inicio}
                    onChange={(e) => {
                      const updated = [...faixas];
                      updated[idx] = { ...updated[idx], inicio: e.target.value };
                      setFaixas(updated);
                    }}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Fim</Label>
                  <Input
                    type="time"
                    value={f.fim}
                    onChange={(e) => {
                      const updated = [...faixas];
                      updated[idx] = { ...updated[idx], fim: e.target.value };
                      setFaixas(updated);
                    }}
                  />
                </div>
                <div className="w-20 space-y-1">
                  <Label className="text-xs">Mult.</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="1"
                    value={f.multiplicador}
                    onChange={(e) => {
                      const updated = [...faixas];
                      updated[idx] = { ...updated[idx], multiplicador: parseFloat(e.target.value) || 1 };
                      setFaixas(updated);
                    }}
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setFaixas(faixas.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFaixas([...faixas, { inicio: "18:00", fim: "22:00", multiplicador: 1.5 }])}
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar faixa
            </Button>
            <Button className="w-full" onClick={saveSurge} disabled={savingSurge}>
              {savingSurge ? "Salvando..." : <><Save className="h-4 w-4 mr-2" />Salvar faixas de horário</>}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={editingBairro} onOpenChange={setEditingBairro}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Bairro</DialogTitle>
            <DialogDescription>Altere os dados do bairro</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={editCidade} onChange={(e) => setEditCidade(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Estado (sigla)</Label>
              <Input value={editEstado} onChange={(e) => setEditEstado(e.target.value)} maxLength={2} />
            </div>
            <Button className="w-full" onClick={saveBairro}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Override form dialog */}
      <Dialog open={showOverrideForm} onOpenChange={setShowOverrideForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOverride ? "Editar Preço" : "Novo Preço Personalizado"}</DialogTitle>
            <DialogDescription>Defina um preço específico para este bairro</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={overrideItemId}
                onChange={(e) => setOverrideItemId(e.target.value)}
              >
                <option value="">Selecione um item</option>
                {(editingOverride ? itensGlobal : availableItems).map((i) => (
                  <option key={i.id} value={i.id}>{i.nome} (R$ {Number(i.preco_base).toFixed(2)})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Preço para este bairro (R$)</Label>
              <Input type="number" step="0.01" value={overridePreco} onChange={(e) => setOverridePreco(e.target.value)} />
            </div>
            <Button className="w-full" onClick={saveOverride}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Config form dialog */}
      <Dialog open={showConfigForm} onOpenChange={setShowConfigForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Configuração</DialogTitle>
            <DialogDescription>Adicione uma configuração específica para este bairro</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Chave</Label>
              <Input value={configKey} onChange={(e) => setConfigKey(e.target.value)} placeholder="Ex: taxa_percentual" />
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input type="number" step="0.01" value={configValor} onChange={(e) => setConfigValor(e.target.value)} />
            </div>
            <Button className="w-full" onClick={addConfig}>Criar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
