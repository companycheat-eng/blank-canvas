import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { User, Phone, MapPin, Truck, Pencil, CreditCard, Calendar, Mail, Search, ChevronLeft, ChevronRight, Ban, Clock, Trash2, ShieldCheck } from "lucide-react";
import { format, addDays, isAfter } from "date-fns";

interface ClienteRow {
  id: string;
  nome: string;
  telefone: string;
  cpf: string;
  email: string;
  bairro_id: string;
  bairro_nome: string;
  bairro_cidade: string;
  bairro_estado: string;
  total_corridas: number;
  created_at: string;
  status: string;
  suspenso_ate: string | null;
  user_id: string;
}

interface Bairro {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
}

export default function AdminClientes() {
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [editing, setEditing] = useState<ClienteRow | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editCpf, setEditCpf] = useState("");
  const [editBairroId, setEditBairroId] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSenha, setEditSenha] = useState("");
  const [saving, setSaving] = useState(false);
  const [suspendDialogCliente, setSuspendDialogCliente] = useState<ClienteRow | null>(null);
  const [suspendDays, setSuspendDays] = useState("");

  const load = async () => {
    const [{ data: clientesData }, { data: bairrosData }] = await Promise.all([
      supabase.from("clientes").select("id, nome, telefone, cpf, email, bairro_id, created_at, status, suspenso_ate, user_id, bairros(nome, cidade, estado)").order("nome"),
      supabase.from("bairros").select("id, nome, cidade, estado").eq("ativo", true).order("nome"),
    ]);

    setBairros((bairrosData as Bairro[]) || []);

    if (!clientesData) { setLoading(false); return; }

    const clienteIds = clientesData.map((c: any) => c.id);
    const { data: corridasData } = await supabase
      .from("corridas")
      .select("cliente_id")
      .in("cliente_id", clienteIds.length > 0 ? clienteIds : ["__none__"]);

    const countMap: Record<string, number> = {};
    (corridasData || []).forEach((c: any) => {
      countMap[c.cliente_id] = (countMap[c.cliente_id] || 0) + 1;
    });

    setClientes(
      clientesData.map((c: any) => ({
        id: c.id,
        nome: c.nome || "Sem nome",
        telefone: c.telefone,
        cpf: c.cpf,
        email: c.email || "",
        bairro_id: c.bairro_id,
        bairro_nome: c.bairros?.nome || "—",
        bairro_cidade: c.bairros?.cidade || "—",
        bairro_estado: c.bairros?.estado || "—",
        total_corridas: countMap[c.id] || 0,
        created_at: c.created_at,
        status: c.status || "ativo",
        suspenso_ate: c.suspenso_ate,
        user_id: c.user_id,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (c: ClienteRow) => {
    setEditing(c);
    setEditNome(c.nome);
    setEditTelefone(c.telefone);
    setEditCpf(c.cpf);
    setEditEmail(c.email);
    setEditSenha("");
    setEditBairroId(c.bairro_id);
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editNome.trim() || !editTelefone.trim() || !editCpf.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    setSaving(true);

    const telefoneLimpo = editTelefone.replace(/\D/g, "");
    const telefoneAntigo = editing.telefone.replace(/\D/g, "");

    // If phone changed, update the auth email too
    if (telefoneLimpo !== telefoneAntigo) {
      // Get user_id for this cliente
      const { data: clienteData } = await supabase
        .from("clientes")
        .select("user_id")
        .eq("id", editing.id)
        .single();

      if (clienteData?.user_id) {
        const newFakeEmail = `${telefoneLimpo}@carreto.app`;
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ target_user_id: clienteData.user_id, email: newFakeEmail }),
        });

        const result = await res.json();
        if (!res.ok || result.error) {
          toast.error("Erro ao atualizar login: " + (result.error || "Erro desconhecido"));
          setSaving(false);
          return;
        }
      }
    }

    const { error } = await supabase
      .from("clientes")
      .update({ nome: editNome.trim(), telefone: telefoneLimpo, cpf: editCpf.trim(), email: editEmail.trim(), bairro_id: editBairroId })
      .eq("id", editing.id);

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    // Update password if provided
    if (editSenha.trim()) {
      const { data: clienteData2 } = await supabase.from("clientes").select("user_id").eq("id", editing.id).single();
      if (clienteData2?.user_id) {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ target_user_id: clienteData2.user_id, password: editSenha.trim() }),
        });
        const result = await res.json();
        if (!res.ok || result.error) {
          toast.error("Dados salvos, mas erro ao atualizar senha: " + (result.error || "Erro desconhecido"));
          setSaving(false);
          setEditing(null);
          load();
          return;
        }
      }
    }

    toast.success("Cliente atualizado!");
    setEditing(null);
    load();
    setSaving(false);
  };

  const blockCliente = async (c: ClienteRow) => {
    const newStatus = c.status === "bloqueado" ? "ativo" : "bloqueado";
    const { error } = await supabase.from("clientes").update({ status: newStatus, suspenso_ate: null }).eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success(newStatus === "bloqueado" ? "Cliente bloqueado!" : "Cliente desbloqueado!"); load(); }
  };

  const suspendCliente = async () => {
    if (!suspendDialogCliente || !suspendDays) return;
    const days = parseInt(suspendDays);
    const suspensoAte = addDays(new Date(), days).toISOString();
    const { error } = await supabase.from("clientes").update({ status: "suspenso", suspenso_ate: suspensoAte }).eq("id", suspendDialogCliente.id);
    if (error) toast.error(error.message);
    else { toast.success(`Cliente suspenso por ${days} dias!`); setSuspendDialogCliente(null); setSuspendDays(""); load(); }
  };

  const softDeleteCliente = async (c: ClienteRow) => {
    const { error } = await supabase.from("clientes").update({ status: "excluido" }).eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Cliente removido!"); load(); }
  };

  const getClienteStatusBadge = (c: ClienteRow) => {
    if (c.status === "bloqueado") return <Badge className="bg-destructive text-destructive-foreground">Bloqueado</Badge>;
    if (c.status === "suspenso" && c.suspenso_ate && isAfter(new Date(c.suspenso_ate), new Date())) {
      return <Badge className="bg-warning text-warning-foreground">Suspenso até {format(new Date(c.suspenso_ate), "dd/MM")}</Badge>;
    }
    if (c.status === "excluido") return <Badge variant="secondary">Excluído</Badge>;
    return null;
  };

  const formatCpf = (cpf: string) => {
    const clean = cpf.replace(/\D/g, "");
    if (clean.length === 11) return `${clean.slice(0,3)}.${clean.slice(3,6)}.${clean.slice(6,9)}-${clean.slice(9)}`;
    return cpf;
  };

  const filtered = clientes.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().replace(/\D/g, "") || search.toLowerCase();
    const searchLower = search.toLowerCase();
    return (
      c.telefone.includes(q) ||
      c.cpf.replace(/\D/g, "").includes(q) ||
      c.email.toLowerCase().includes(searchLower) ||
      c.nome.toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Clientes</h2>
        <Badge variant="secondary">{filtered.length} de {clientes.length}</Badge>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por telefone, email, CPF ou nome..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm animate-pulse">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">{search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}</p>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((c) => (
              <Card key={c.id} className="shadow-sm">
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{c.nome}</p>
                        {getClienteStatusBadge(c)}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.telefone}</span>
                        {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</span>}
                        <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> {formatCpf(c.cpf)}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {c.bairro_nome}, {c.bairro_cidade} - {c.bairro_estado}</span>
                        <span className="flex items-center gap-1"><Truck className="h-3 w-3" /> {c.total_corridas} corridas</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(c.created_at), "dd/MM/yyyy")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 border-t pt-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4 mr-1" /> Editar</Button>
                      {c.status === "bloqueado" ? (
                        <Button size="sm" variant="ghost" onClick={() => blockCliente(c)} className="text-success"><ShieldCheck className="h-4 w-4 mr-1" /> Desbloquear</Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => blockCliente(c)} className="text-destructive"><Ban className="h-4 w-4 mr-1" /> Bloquear</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => { setSuspendDialogCliente(c); setSuspendDays(""); }}><Clock className="h-4 w-4 mr-1" /> Suspender</Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir cliente "{c.nome}"?</AlertDialogTitle>
                            <AlertDialogDescription>O cliente será marcado como excluído e não poderá mais acessar o app.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => softDeleteCliente(c)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
              <span className="text-sm text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>Altere os dados do cliente</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={editTelefone} onChange={(e) => setEditTelefone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
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
            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-semibold">Credenciais (deixe em branco para não alterar)</p>
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

      {/* Suspend Dialog */}
      <Dialog open={!!suspendDialogCliente} onOpenChange={(open) => !open && setSuspendDialogCliente(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspender Cliente</DialogTitle>
            <DialogDescription>{suspendDialogCliente?.nome} — Escolha o período de suspensão</DialogDescription>
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
            <Button className="w-full" onClick={suspendCliente} disabled={!suspendDays}>
              Confirmar suspensão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
