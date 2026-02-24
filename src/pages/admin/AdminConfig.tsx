import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Settings, Plus, Save, FileDown, CreditCard, MapPin, Upload, Trash2, Key } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface ConfigItem {
  key: string;
  value: any;
  descricao: string | null;
}

const LABELS: Record<string, string> = {
  taxa_percentual: "Taxa % cobrada do motorista",
  valor_por_km: "Valor por km (R$)",
  taxa_base: "Taxa base por corrida (R$)",
  timeout_busca_segundos: "Timeout de busca (segundos)",
  creditos_por_real: "Créditos por R$ 1,00",
  contra_proposta_limites: "Limites de contra-proposta (%)",
  smtp_config: "Configuração SMTP (Email)",
  ajudante_preco: "Preço do ajudante (R$)",
};

const MARKER_TYPES = [
  { key: "marker_motorista", label: "Motorista online", desc: "Ícone padrão dos motoristas no mapa (usado quando tipo de veículo não definido)" },
  { key: "marker_origem", label: "Ponto de coleta", desc: "Ícone do ponto de origem/coleta" },
  { key: "marker_destino", label: "Ponto de entrega", desc: "Ícone do ponto de destino/entrega" },
  { key: "marker_cliente", label: "Localização do cliente", desc: "Ícone da posição do cliente no mapa" },
];


const MP_GLOBAL_KEYS = ["mp_access_token", "mp_webhook_secret", "mp_api_base_url", "mp_app_base_url"];
const MP_GLOBAL_LABELS: Record<string, { label: string; placeholder: string; type?: string }> = {
  mp_access_token: { label: "Access Token", placeholder: "APP_USR-...", type: "password" },
  mp_webhook_secret: { label: "Webhook Secret", placeholder: "Chave secreta do webhook", type: "password" },
  mp_api_base_url: { label: "URL API MP Base", placeholder: "https://api.mercadopago.com" },
  mp_app_base_url: { label: "App Base URL (webhook)", placeholder: "https://xivglpmjbwzlojlafxjh.supabase.co/functions/v1/mp-webhook" },
};

export default function AdminConfig() {
  const { userType } = useAuth();
  const navigate = useNavigate();
  const isGeral = userType === "admin_geral";
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newValor, setNewValor] = useState("");
  const [mpEdits, setMpEdits] = useState<Record<string, string>>({});
  const [savingMp, setSavingMp] = useState(false);
  const [markerUrls, setMarkerUrls] = useState<Record<string, string>>({});
  const [uploadingMarker, setUploadingMarker] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  const [mapsApiKey, setMapsApiKey] = useState("");
  const [savingMapsKey, setSavingMapsKey] = useState(false);

  const loadMarkers = async () => {
    const urls: Record<string, string> = {};
    const allMarkerKeys = [...MARKER_TYPES];
    for (const m of allMarkerKeys) {
      const { data } = await supabase.from("config_global").select("value").eq("key", m.key).maybeSingle();
      if (data?.value) {
        const val = typeof data.value === "string" ? data.value : (data.value as any)?.url;
        if (val) urls[m.key] = val;
      }
    }
    setMarkerUrls(urls);
  };

  const uploadMarkerIcon = async (markerKey: string, file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Envie apenas imagens"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Imagem muito grande (máx 2MB)"); return; }
    setUploadingMarker(markerKey);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${markerKey}.${ext}`;
      // Remove old file
      await supabase.storage.from("marker-icons").remove([path]);
      const { error: upErr } = await supabase.storage.from("marker-icons").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("marker-icons").getPublicUrl(path);
      const publicUrl = urlData.publicUrl + "?t=" + Date.now();
      // Save URL in config_global
      const existing = await supabase.from("config_global").select("key").eq("key", markerKey).maybeSingle();
      if (existing.data) {
        await supabase.from("config_global").update({ value: { url: publicUrl } }).eq("key", markerKey);
      } else {
        await supabase.from("config_global").insert({ key: markerKey, value: { url: publicUrl }, descricao: MARKER_TYPES.find(m => m.key === markerKey)?.desc || null });
      }
      setMarkerUrls(prev => ({ ...prev, [markerKey]: publicUrl }));
      toast.success("Marcador atualizado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar imagem");
    } finally {
      setUploadingMarker(null);
    }
  };

  const removeMarkerIcon = async (markerKey: string) => {
    try {
      // List and remove all files starting with markerKey
      const { data: files } = await supabase.storage.from("marker-icons").list("", { search: markerKey });
      if (files?.length) {
        await supabase.storage.from("marker-icons").remove(files.map(f => f.name));
      }
      await supabase.from("config_global").delete().eq("key", markerKey);
      setMarkerUrls(prev => { const n = { ...prev }; delete n[markerKey]; return n; });
      toast.success("Marcador removido, voltará ao padrão");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const load = async () => {
    const { data } = await supabase.from("config_global").select("*").order("key");
    const items = (data || []).map((d: any) => ({
      key: d.key,
      value: d.value as any,
      descricao: d.descricao,
    }));
    setConfigs(items);
    const editMap: Record<string, string> = {};
    const mpMap: Record<string, string> = {};
    items.forEach((c) => {
      if (MP_GLOBAL_KEYS.includes(c.key)) {
        mpMap[c.key] = typeof c.value === "string" ? c.value : String((c.value as any)?.valor ?? "");
      } else if (c.key === "contra_proposta_limites") {
        editMap[`${c.key}_min`] = String((c.value as any)?.min_pct ?? -30);
        editMap[`${c.key}_max`] = String((c.value as any)?.max_pct ?? 30);
      } else if (c.key === "smtp_config") {
        editMap[`${c.key}_host`] = String((c.value as any)?.host ?? "smtp.gmail.com");
        editMap[`${c.key}_port`] = String((c.value as any)?.port ?? 587);
        editMap[`${c.key}_email`] = String((c.value as any)?.email ?? "");
        editMap[`${c.key}_password`] = String((c.value as any)?.password ?? "");
      } else {
        editMap[c.key] = String((c.value as any)?.valor ?? "");
      }
    });
    setEdits(editMap);
    // Load Google Maps API key from config_global
    const mapsKeyConfig = items.find(c => c.key === "google_maps_api_key");
    if (mapsKeyConfig) {
      setMapsApiKey(typeof mapsKeyConfig.value === "string" ? mapsKeyConfig.value : (mapsKeyConfig.value as any)?.valor || "");
    }
  };

  useEffect(() => { load(); loadMarkers(); }, []);

  const save = async (key: string) => {
    if (key === "contra_proposta_limites") {
      const minPct = parseFloat(edits[`${key}_min`]);
      const maxPct = parseFloat(edits[`${key}_max`]);
      if (isNaN(minPct) || isNaN(maxPct)) { toast.error("Valores inválidos"); return; }
      const { error } = await supabase.from("config_global").update({ value: { min_pct: minPct, max_pct: maxPct } }).eq("key", key);
      if (error) toast.error(error.message);
      else { toast.success("Configuração salva!"); load(); }
      return;
    }
    if (key === "smtp_config") {
      const smtpValue = {
        host: edits[`${key}_host`] || "",
        port: parseInt(edits[`${key}_port`]) || 587,
        email: edits[`${key}_email`] || "",
        password: edits[`${key}_password`] || "",
      };
      if (!smtpValue.email || !smtpValue.password) { toast.error("Email e senha são obrigatórios"); return; }
      const { error } = await supabase.from("config_global").upsert({ key, value: smtpValue, descricao: "Configuração SMTP para envio de emails" }).eq("key", key);
      if (error) toast.error(error.message);
      else { toast.success("SMTP salvo!"); load(); }
      return;
    }
    const val = parseFloat(edits[key]);
    if (isNaN(val)) { toast.error("Valor inválido"); return; }
    const { error } = await supabase.from("config_global").update({ value: { valor: val } }).eq("key", key);
    if (error) toast.error(error.message);
    else { toast.success("Configuração salva!"); load(); }
  };

  const addConfig = async () => {
    if (!newKey.trim() || !newValor.trim()) { toast.error("Preencha chave e valor"); return; }
    const val = parseFloat(newValor);
    if (isNaN(val)) { toast.error("Valor inválido"); return; }
    const { error } = await supabase.from("config_global").insert({
      key: newKey.trim(),
      descricao: newDesc.trim() || null,
      value: { valor: val },
    });
    if (error) toast.error(error.message);
    else { toast.success("Configuração criada!"); setShowAdd(false); setNewKey(""); setNewDesc(""); setNewValor(""); load(); }
  };

  const saveMpGlobal = async () => {
    setSavingMp(true);
    try {
      for (const key of MP_GLOBAL_KEYS) {
        const val = (mpEdits[key] || "").trim();
        if (!val) continue;
        const existing = configs.find((c) => c.key === key);
        if (existing) {
          await supabase.from("config_global").update({ value: val }).eq("key", key);
        } else {
          await supabase.from("config_global").insert({
            key,
            descricao: `Gateway MercadoPago - ${MP_GLOBAL_LABELS[key]?.label || key}`,
            value: val,
          });
        }
      }
      toast.success("Gateway global salvo! Bairros sem config própria usarão esta.");
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingMp(false);
    }
  };

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Configurações</h2>
        {isGeral && (
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova
          </Button>
        )}
      </div>

      {/* Gateway Global MercadoPago */}
      {isGeral && (
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <CreditCard className="h-5 w-5 text-primary" /> Gateway de Pagamento Global
          </h3>
          <Card className="shadow-sm">
            <CardContent className="py-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Configuração padrão do MercadoPago. Será usada em todos os bairros que <strong>não</strong> tiverem gateway próprio configurado.
              </p>
              {MP_GLOBAL_KEYS.map((key) => {
                const cfg = MP_GLOBAL_LABELS[key];
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
              <Button className="w-full" onClick={saveMpGlobal} disabled={savingMp}>
                {savingMp ? "Salvando..." : <><Save className="h-4 w-4 mr-2" />Salvar Gateway Global</>}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Marcadores do Mapa */}
      {isGeral && (
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <MapPin className="h-5 w-5 text-primary" /> Marcadores do Mapa
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {MARKER_TYPES.map((m) => (
              <Card key={m.key} className="shadow-sm">
                <CardContent className="py-3 space-y-2">
                  <p className="font-semibold text-xs">{m.label}</p>
                  <p className="text-[10px] text-muted-foreground">{m.desc}</p>
                  {markerUrls[m.key] ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 flex items-center justify-center rounded-lg border bg-muted">
                        <img src={markerUrls[m.key]} alt={m.label} className="max-w-10 max-h-10 object-contain" />
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => fileInputRefs.current[m.key]?.click()}>
                          <Upload className="h-3 w-3 mr-1" />Trocar
                        </Button>
                        <Button size="sm" variant="ghost" className="text-xs h-7 px-2 text-destructive" onClick={() => removeMarkerIcon(m.key)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs h-8"
                      disabled={uploadingMarker === m.key}
                      onClick={() => fileInputRefs.current[m.key]?.click()}
                    >
                      {uploadingMarker === m.key ? "Enviando..." : <><Upload className="h-3 w-3 mr-1" />Upload</>}
                    </Button>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={(el) => { fileInputRefs.current[m.key] = el; }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadMarkerIcon(m.key, file);
                      e.target.value = "";
                    }}
                  />
                </CardContent>
              </Card>
            ))}
          </div>

        </div>
      )}

      {/* Google Maps API Key */}
      {isGeral && (
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Key className="h-5 w-5 text-primary" /> Google Maps API Key
          </h3>
          <Card className="shadow-sm">
            <CardContent className="py-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Chave de API global do Google Maps. Será usada em todos os bairros que <strong>não</strong> tiverem chave própria configurada.
              </p>
              <div className="space-y-1">
                <Label className="text-sm">API Key</Label>
                <Input
                  type="password"
                  placeholder="AIza..."
                  value={mapsApiKey}
                  onChange={(e) => setMapsApiKey(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={async () => {
                if (!mapsApiKey.trim()) { toast.error("Informe a API Key"); return; }
                setSavingMapsKey(true);
                try {
                  const existing = configs.find(c => c.key === "google_maps_api_key");
                  if (existing) {
                    await supabase.from("config_global").update({ value: mapsApiKey.trim() }).eq("key", "google_maps_api_key");
                  } else {
                    await supabase.from("config_global").insert({ key: "google_maps_api_key", value: mapsApiKey.trim(), descricao: "Chave API Google Maps global" });
                  }
                  toast.success("API Key salva!");
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
      )}

      <div className="space-y-3">
        {configs.filter((c) => (isGeral || c.key !== "smtp_config") && !MP_GLOBAL_KEYS.includes(c.key) && !c.key.startsWith("marker_") && c.key !== "google_maps_api_key").map((c) => (
          <Card key={c.key} className="shadow-sm">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                <div>
                  <p className="font-semibold text-sm">{LABELS[c.key] || c.key}</p>
                  {c.descricao && <p className="text-xs text-muted-foreground">{c.descricao}</p>}
                </div>
              </div>
              {c.key === "contra_proposta_limites" ? (
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <Label className="text-xs w-20 shrink-0">Mín %</Label>
                    <Input type="number" value={edits[`${c.key}_min`] || ""} onChange={(e) => setEdits({ ...edits, [`${c.key}_min`]: e.target.value })} disabled={!isGeral} />
                  </div>
                  <div className="flex gap-2 items-center">
                    <Label className="text-xs w-20 shrink-0">Máx %</Label>
                    <Input type="number" value={edits[`${c.key}_max`] || ""} onChange={(e) => setEdits({ ...edits, [`${c.key}_max`]: e.target.value })} disabled={!isGeral} />
                  </div>
                  {isGeral && (
                    <Button size="sm" className="w-full" onClick={() => save(c.key)}>
                      <Save className="h-4 w-4 mr-1" /> Salvar
                    </Button>
                  )}
                </div>
              ) : c.key === "smtp_config" ? (
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <Label className="text-xs w-20 shrink-0">Host</Label>
                    <Input value={edits[`${c.key}_host`] || ""} onChange={(e) => setEdits({ ...edits, [`${c.key}_host`]: e.target.value })} disabled={!isGeral} placeholder="smtp.gmail.com" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <Label className="text-xs w-20 shrink-0">Porta</Label>
                    <Input type="number" value={edits[`${c.key}_port`] || ""} onChange={(e) => setEdits({ ...edits, [`${c.key}_port`]: e.target.value })} disabled={!isGeral} placeholder="587" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <Label className="text-xs w-20 shrink-0">Email</Label>
                    <Input value={edits[`${c.key}_email`] || ""} onChange={(e) => setEdits({ ...edits, [`${c.key}_email`]: e.target.value })} disabled={!isGeral} placeholder="seu@gmail.com" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <Label className="text-xs w-20 shrink-0">Senha App</Label>
                    <Input type="password" value={edits[`${c.key}_password`] || ""} onChange={(e) => setEdits({ ...edits, [`${c.key}_password`]: e.target.value })} disabled={!isGeral} placeholder="senha de app do Gmail" />
                  </div>
                  {isGeral && (
                    <Button size="sm" className="w-full" onClick={() => save(c.key)}>
                      <Save className="h-4 w-4 mr-1" /> Salvar
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input type="number" step="0.01" value={edits[c.key] || ""} onChange={(e) => setEdits({ ...edits, [c.key]: e.target.value })} className="flex-1" disabled={!isGeral} />
                  {isGeral && (
                    <Button size="sm" onClick={() => save(c.key)}>
                      <Save className="h-4 w-4 mr-1" /> Salvar
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {isGeral && (
        <Card className="shadow-sm cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate("/admin/migracao")}>
          <CardContent className="flex items-center gap-3 py-4">
            <FileDown className="h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold text-sm">Guia de Migração</p>
              <p className="text-xs text-muted-foreground">Documentação de secrets, configs e passos para migrar o sistema</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Configuração</DialogTitle>
            <DialogDescription>Adicione uma nova configuração global</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Chave (identificador)</Label>
              <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="Ex: raio_maximo_km" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Ex: Raio máximo de atendimento" />
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input type="number" step="0.01" value={newValor} onChange={(e) => setNewValor(e.target.value)} placeholder="0" />
            </div>
            <Button className="w-full" onClick={addConfig}>Criar configuração</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
