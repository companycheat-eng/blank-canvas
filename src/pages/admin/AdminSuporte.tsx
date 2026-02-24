import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Loader2, HeadphonesIcon } from "lucide-react";
import { toast } from "@/components/ui/sonner";

interface SuporteAgent {
  id: string;
  user_id: string;
  email?: string;
  nome?: string;
}

export default function AdminSuporte() {
  const { session } = useAuth();
  const [agents, setAgents] = useState<SuporteAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const loadAgents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("user_roles")
      .select("id, user_id")
      .eq("role", "suporte");

    if (data && data.length > 0) {
      // Fetch user metadata via edge function would be complex,
      // so we'll display the role records
      setAgents(data.map((r) => ({ id: r.id, user_id: r.user_id })));
    } else {
      setAgents([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleCreate = async () => {
    if (!nome.trim() || !email.trim() || !password.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    if (password.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres");
      return;
    }

    setCreating(true);
    try {
      const res = await supabase.functions.invoke("manage-suporte", {
        body: { action: "create", nome: nome.trim(), email: email.trim(), password },
      });

      if (res.error || res.data?.error) {
        toast.error(res.data?.error || res.error?.message || "Erro ao criar agente");
      } else {
        toast.success("Agente de suporte criado!");
        setDialogOpen(false);
        setNome("");
        setEmail("");
        setPassword("");
        loadAgents();
      }
    } catch {
      toast.error("Erro inesperado");
    }
    setCreating(false);
  };

  const handleRemove = async (userId: string) => {
    try {
      const res = await supabase.functions.invoke("manage-suporte", {
        body: { action: "delete", user_id: userId },
      });

      if (res.error || res.data?.error) {
        toast.error(res.data?.error || "Erro ao remover");
      } else {
        toast.success("Role de suporte removido");
        loadAgents();
      }
    } catch {
      toast.error("Erro inesperado");
    }
  };

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Agentes de Suporte</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Novo Agente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Agente de Suporte</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do agente" maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" maxLength={255} />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" maxLength={128} />
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Criar Agente
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8 animate-pulse">Carregando...</p>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <HeadphonesIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nenhum agente de suporte cadastrado.</p>
            <p className="text-xs text-muted-foreground mt-1">Clique em "Novo Agente" para criar.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.user_id.slice(0, 8)}...</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleRemove(a.user_id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
