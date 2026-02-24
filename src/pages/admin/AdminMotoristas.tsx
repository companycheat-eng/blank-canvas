import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Check, X, Eye, User, Phone, MapPin, CreditCard, Calendar, Pencil, Search, ChevronLeft, ChevronRight, Plus, Wallet, Clock, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, addDays, isAfter } from "date-fns";

interface Bairro {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
}

interface Motorista {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  status_kyc: string;
  kyc_motivo: string | null;
  selfie_url: string | null;
  cnh_url: string | null;
  doc_veiculo_url: string | null;
  foto_url: string | null;
  saldo_creditos: number;
  status_online: string;
  bairro_id: string;
  bairro_nome: string;
  bairro_cidade: string;
  bairro_estado: string;
  created_at: string;
  user_id: string;
  placa: string | null;
  tipo_veiculo: string | null;
  marca_veiculo: string | null;
  cor_veiculo: string | null;
  suspenso_ate: string | null;
}

const KYC_COLORS: Record<string, string> = {
  pendente_analise: "bg-warning text-warning-foreground",
  aprovado: "bg-success text-success-foreground",
  reprovado: "bg-destructive text-destructive-foreground",
  bloqueado: "bg-foreground text-background",
};

const profileStorageUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/profile-photos`;

export default function AdminMotoristas() {
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [tab, setTab] = useState("pendente_analise");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;

  // View/KYC dialog
  const [selectedMotorista, setSelectedMotorista] = useState<Motorista | null>(null);
  const [kycSignedUrls, setKycSignedUrls] = useState<{ selfie?: string; cnh?: string; doc_veiculo?: string }>({});
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  // Edit dialog
  const [editing, setEditing] = useState<Motorista | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editCpf, setEditCpf] = useState("");
  const [editBairroId, setEditBairroId] = useState("");
  const [editPlaca, setEditPlaca] = useState("");
  const [editTipoVeiculo, setEditTipoVeiculo] = useState("");
  const [editMarcaVeiculo, setEditMarcaVeiculo] = useState("");
  const [editCorVeiculo, setEditCorVeiculo] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSenha, setEditSenha] = useState("");
  const [saving, setSaving] = useState(false);

  // Credit dialog
  const [creditMotorista, setCreditMotorista] = useState<Motorista | null>(null);
  const [creditValor, setCreditValor] = useState("");
  const [creditMotivo, setCreditMotivo] = useState("");
  const [addingCredit, setAddingCredit] = useState(false);
  const [suspendDialogMotorista, setSuspendDialogMotorista] = useState<Motorista | null>(null);
  const [suspendDays, setSuspendDays] = useState("");

  const load = async () => {
    const [{ data: motoristasData }, { data: bairrosData }] = await Promise.all([
      supabase.from("motoristas").select("*, bairros(nome, cidade, estado)").order("created_at", { ascending: false }),
      supabase.from("bairros").select("id, nome, cidade, estado").eq("ativo", true).order("nome"),
    ]);

    setBairros((bairrosData as Bairro[]) || []);

    setMotoristas(
      (motoristasData || []).map((m: any) => ({
        ...m,
        bairro_nome: m.bairros?.nome || "—",
        bairro_cidade: m.bairros?.cidade || "—",
        bairro_estado: m.bairros?.estado || "—",
      }))
    );
  };

  useEffect(() => { load(); }, []);

  const updateKYC = async (motoristaId: string, status: "pendente_analise" | "aprovado" | "reprovado" | "bloqueado", motivo?: string) => {
    const { error } = await supabase.from("motoristas")
      .update({ status_kyc: status, kyc_motivo: motivo || null })
      .eq("id", motoristaId);
    if (error) toast.error(error.message);
    else { toast.success(`Motorista ${status}!`); load(); setSelectedMotorista(null); }
  };

  const openEdit = async (m: Motorista) => {
    setEditing(m);
    setEditNome(m.nome);
    setEditTelefone(m.telefone);
    setEditCpf(m.cpf);
    setEditBairroId(m.bairro_id);
    setEditPlaca(m.placa || "");
    setEditTipoVeiculo(m.tipo_veiculo || "");
    setEditMarcaVeiculo(m.marca_veiculo || "");
    setEditCorVeiculo(m.cor_veiculo || "");
    setEditSenha("");
    // Fetch email from auth via edge function is not needed, we show a field to set new email
    setEditEmail("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editNome.trim() || !editTelefone.trim() || !editCpf.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSaving(true);

    // Update motorista table
    const { error } = await supabase.from("motoristas")
      .update({
        nome: editNome.trim(),
        telefone: editTelefone.trim(),
        cpf: editCpf.trim(),
        bairro_id: editBairroId,
        placa: editPlaca.trim().toUpperCase() || null,
        tipo_veiculo: editTipoVeiculo || null,
        marca_veiculo: editMarcaVeiculo.trim() || null,
        cor_veiculo: editCorVeiculo.trim() || null,
      })
      .eq("id", editing.id);

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    // Update auth email/password if provided
    if (editEmail.trim() || editSenha.trim()) {
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            target_user_id: editing.user_id,
            email: editEmail.trim() || undefined,
            password: editSenha.trim() || undefined,
          }),
        });
        const result = await res.json();
        if (!res.ok) {
          toast.error(result.error || "Erro ao atualizar credenciais");
          setSaving(false);
          return;
        }
      } catch (err: any) {
        toast.error(err.message || "Erro ao atualizar credenciais");
        setSaving(false);
        return;
      }
    }

    toast.success("Motorista atualizado!");
    setEditing(null);
    load();
    setSaving(false);
  };

  const handleAddCredit = async () => {
    if (!creditMotorista) return;
    const valor = parseFloat(creditValor);
    if (isNaN(valor) || valor <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (!creditMotivo.trim()) {
      toast.error("Informe o motivo");
      return;
    }
    setAddingCredit(true);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-add-credit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          motorista_id: creditMotorista.id,
          valor,
          motivo: creditMotivo.trim(),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Erro ao adicionar crédito");
        setAddingCredit(false);
        return;
      }
    } catch (err: any) {
      toast.error(err.message);
      setAddingCredit(false);
      return;
    }

    toast.success(`R$ ${valor.toFixed(2)} adicionados ao motorista!`);
    setCreditMotorista(null);
    setCreditValor("");
    setCreditMotivo("");
    setAddingCredit(false);
    load();
  };

  const suspendMotorista = async () => {
    if (!suspendDialogMotorista || !suspendDays) return;
    const days = parseInt(suspendDays);
    const suspensoAte = addDays(new Date(), days).toISOString();
    const { error } = await supabase.from("motoristas").update({ suspenso_ate: suspensoAte }).eq("id", suspendDialogMotorista.id);
    if (error) toast.error(error.message);
    else { toast.success(`Motorista suspenso por ${days} dias!`); setSuspendDialogMotorista(null); setSuspendDays(""); load(); }
  };

  const softDeleteMotorista = async (m: Motorista) => {
    const { error } = await supabase.from("motoristas").update({ status_kyc: "bloqueado" as any, kyc_motivo: "Excluído pelo admin" }).eq("id", m.id);
    if (error) toast.error(error.message);
    else { toast.success("Motorista excluído (bloqueado)!"); load(); }
  };

  const getSuspensionBadge = (m: Motorista) => {
    if (m.suspenso_ate && isAfter(new Date(m.suspenso_ate), new Date())) {
      return <Badge className="bg-warning text-warning-foreground">Suspenso até {format(new Date(m.suspenso_ate), "dd/MM")}</Badge>;
    }
    return null;
  };

  const formatCpf = (cpf: string) => {
    const clean = cpf.replace(/\D/g, "");
    if (clean.length === 11) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
    return cpf;
  };

  const getPhotoUrl = (m: Motorista) => {
    if (m.foto_url) return `${profileStorageUrl}/${m.foto_url}`;
    return null;
  };

  const filtered = motoristas.filter((m) => {
    if (m.status_kyc !== tab) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.nome.toLowerCase().includes(q) ||
      m.telefone.includes(q) ||
      m.cpf.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
      m.bairro_nome.toLowerCase().includes(q) ||
      m.bairro_cidade.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Motoristas & KYC</h2>
        <Badge variant="secondary">{filtered.length} de {motoristas.length}</Badge>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setPage(1); }}>
        <TabsList className="w-full">
          <TabsTrigger value="pendente_analise" className="flex-1">Pendentes</TabsTrigger>
          <TabsTrigger value="aprovado" className="flex-1">Aprovados</TabsTrigger>
          <TabsTrigger value="reprovado" className="flex-1">Reprovados</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone, CPF, bairro ou cidade..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Nenhum motorista nesta categoria.</p>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((m) => {
              const photoUrl = getPhotoUrl(m);
              return (
                <Card key={m.id} className="shadow-sm">
                  <CardContent className="py-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {photoUrl ? (
                          <img src={photoUrl} alt="Foto" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <User className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">{m.nome}</p>
                          <Badge className={`${KYC_COLORS[m.status_kyc] || ""} shrink-0`}>{m.status_kyc.replace("_", " ")}</Badge>
                          {getSuspensionBadge(m)}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {m.telefone}
                          </span>
                          <span className="flex items-center gap-1">
                            <CreditCard className="h-3 w-3" /> {formatCpf(m.cpf)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {m.bairro_nome}, {m.bairro_cidade} - {m.bairro_estado}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {format(new Date(m.created_at), "dd/MM/yyyy")}
                          </span>
                          <span className="text-xs">💰 R$ {Number(m.saldo_creditos).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 border-t pt-2">
                      <Button size="sm" variant="ghost" onClick={async () => {
                        setSelectedMotorista(m);
                        setSelectedEmail(null);
                        const urls: { selfie?: string; cnh?: string; doc_veiculo?: string } = {};
                        const signedUrlPromises: Promise<void>[] = [];
                        if (m.selfie_url) {
                          signedUrlPromises.push(supabase.storage.from("kyc-documents").createSignedUrl(m.selfie_url, 300).then(({ data }) => { if (data) urls.selfie = data.signedUrl; }));
                        }
                        if (m.cnh_url) {
                          signedUrlPromises.push(supabase.storage.from("kyc-documents").createSignedUrl(m.cnh_url, 300).then(({ data }) => { if (data) urls.cnh = data.signedUrl; }));
                        }
                        if (m.doc_veiculo_url) {
                          signedUrlPromises.push(supabase.storage.from("kyc-documents").createSignedUrl(m.doc_veiculo_url, 300).then(({ data }) => { if (data) urls.doc_veiculo = data.signedUrl; }));
                        }
                        const emailPromise = fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/find-user-email`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
                          body: JSON.stringify({ phone: m.telefone, user_type: "motorista" }),
                        }).then(r => r.json()).then(data => { if (data.email) setSelectedEmail(data.email); }).catch(() => {});
                        await Promise.all([...signedUrlPromises, emailPromise]);
                        setKycSignedUrls(urls);
                      }} title="Ver detalhes">
                        <Eye className="h-4 w-4 mr-1" /> Detalhes
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(m)} title="Editar">
                        <Pencil className="h-4 w-4 mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setCreditMotorista(m)} title="Adicionar crédito">
                        <Plus className="h-4 w-4 mr-1" /> Crédito
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setSuspendDialogMotorista(m); setSuspendDays(""); }}>
                        <Clock className="h-4 w-4 mr-1" /> Suspender
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir motorista "{m.nome}"?</AlertDialogTitle>
                            <AlertDialogDescription>O motorista será bloqueado permanentemente.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => softDeleteMotorista(m)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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

      {/* KYC Dialog */}
      <Dialog open={!!selectedMotorista} onOpenChange={() => { setSelectedMotorista(null); setKycSignedUrls({}); setSelectedEmail(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>KYC - {selectedMotorista?.nome}</DialogTitle>
            <DialogDescription>Verifique os documentos do motorista</DialogDescription>
          </DialogHeader>
          {selectedMotorista && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">CPF:</span> {formatCpf(selectedMotorista.cpf)}</div>
                <div><span className="text-muted-foreground">Tel:</span> {selectedMotorista.telefone}</div>
                {selectedEmail && (
                  <div className="col-span-2"><span className="text-muted-foreground">Email:</span> {selectedEmail}</div>
                )}
                <div><span className="text-muted-foreground">Saldo:</span> R$ {Number(selectedMotorista.saldo_creditos).toFixed(2)}</div>
                <div><span className="text-muted-foreground">Status:</span> {selectedMotorista.status_online}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Local:</span> {selectedMotorista.bairro_nome}, {selectedMotorista.bairro_cidade} - {selectedMotorista.bairro_estado}</div>
                {selectedMotorista.placa && (
                  <div className="col-span-2"><span className="text-muted-foreground">Veículo:</span> {selectedMotorista.tipo_veiculo} {selectedMotorista.marca_veiculo} {selectedMotorista.cor_veiculo} - {selectedMotorista.placa}</div>
                )}
              </div>

              {kycSignedUrls.selfie && (
                <div>
                  <p className="text-sm font-medium mb-1">Selfie</p>
                  <img src={kycSignedUrls.selfie} alt="Selfie" className="w-full max-w-xs rounded-lg mx-auto" />
                </div>
              )}
              {kycSignedUrls.cnh && (
                <div>
                  <p className="text-sm font-medium mb-1">CNH</p>
                  <img src={kycSignedUrls.cnh} alt="CNH" className="w-full max-w-xs rounded-lg mx-auto" />
                </div>
              )}
              {kycSignedUrls.doc_veiculo && (
                <div>
                  <p className="text-sm font-medium mb-1">Documento do Veículo (CRLV)</p>
                  <img src={kycSignedUrls.doc_veiculo} alt="CRLV" className="w-full max-w-xs rounded-lg mx-auto" />
                </div>
              )}

              {selectedMotorista.status_kyc === "pendente_analise" && (
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1 bg-success hover:bg-success/90" onClick={() => updateKYC(selectedMotorista.id, "aprovado")}>
                    <Check className="h-4 w-4 mr-2" /> Aprovar
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={() => updateKYC(selectedMotorista.id, "reprovado", "Documentos ilegíveis")}>
                    <X className="h-4 w-4 mr-2" /> Reprovar
                  </Button>
                </div>
              )}
              {selectedMotorista.status_kyc === "aprovado" && (
                <Button variant="destructive" className="w-full" onClick={() => updateKYC(selectedMotorista.id, "bloqueado", "Bloqueado pelo admin")}>
                  Bloquear motorista
                </Button>
              )}
              {(selectedMotorista.status_kyc === "reprovado" || selectedMotorista.status_kyc === "bloqueado") && (
                <Button className="w-full bg-success hover:bg-success/90" onClick={() => updateKYC(selectedMotorista.id, "aprovado")}>
                  Reativar
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Motorista</DialogTitle>
            <DialogDescription>Altere os dados do motorista</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editing && getPhotoUrl(editing) && (
              <div className="flex justify-center">
                <img src={getPhotoUrl(editing)!} alt="Foto" className="h-20 w-20 rounded-full object-cover border-2 border-primary/20" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={editTelefone} onChange={(e) => setEditTelefone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={editCpf} onChange={(e) => setEditCpf(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Select value={editBairroId} onValueChange={setEditBairroId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o bairro" />
                </SelectTrigger>
                <SelectContent>
                  {bairros.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.nome} - {b.cidade}/{b.estado}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-semibold">Veículo</p>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={editTipoVeiculo} onValueChange={setEditTipoVeiculo}>
                  <SelectTrigger><SelectValue placeholder="Tipo do veículo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Picape">Picape</SelectItem>
                    <SelectItem value="VUC">VUC</SelectItem>
                    <SelectItem value="Caminhão">Caminhão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Placa</Label>
                <Input value={editPlaca} onChange={(e) => setEditPlaca(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input value={editMarcaVeiculo} onChange={(e) => setEditMarcaVeiculo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <Input value={editCorVeiculo} onChange={(e) => setEditCorVeiculo(e.target.value)} />
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-semibold">Credenciais (deixe em branco para não alterar)</p>
              <div className="space-y-2">
                <Label>Novo email</Label>
                <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Novo email (opcional)" />
              </div>
              <div className="space-y-2">
                <Label>Nova senha</Label>
                <Input type="password" value={editSenha} onChange={(e) => setEditSenha(e.target.value)} placeholder="Nova senha (opcional)" />
              </div>
            </div>

            <Button className="w-full" onClick={saveEdit} disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Credit Dialog */}
      <Dialog open={!!creditMotorista} onOpenChange={(open) => !open && setCreditMotorista(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Créditos</DialogTitle>
            <DialogDescription>
              {creditMotorista?.nome} — Saldo atual: R$ {Number(creditMotorista?.saldo_creditos || 0).toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" value={creditValor} onChange={(e) => setCreditValor(e.target.value)} placeholder="Ex: 50.00" min="0.01" step="0.01" />
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Input value={creditMotivo} onChange={(e) => setCreditMotivo(e.target.value)} placeholder="Ex: Bonificação, Ajuste manual..." />
            </div>
            <Button className="w-full" onClick={handleAddCredit} disabled={addingCredit}>
              {addingCredit ? "Adicionando..." : "Adicionar créditos"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <Dialog open={!!suspendDialogMotorista} onOpenChange={(open) => !open && setSuspendDialogMotorista(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspender Motorista</DialogTitle>
            <DialogDescription>{suspendDialogMotorista?.nome} — Escolha o período de suspensão</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[1, 3, 7, 15, 30].map((d) => (
                <Button
                  key={d}
                  variant={suspendDays === String(d) ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSuspendDays(String(d))}
                >
                  {d} {d === 1 ? "dia" : "dias"}
                </Button>
              ))}
            </div>
            <Button className="w-full" onClick={suspendMotorista} disabled={!suspendDays}>
              Confirmar suspensão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
