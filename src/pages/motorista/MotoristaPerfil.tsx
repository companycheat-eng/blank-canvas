import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, LogOut, Car, Lock, Banknote } from "lucide-react";
import { StarRating } from "@/components/StarRating";
import { titleCase } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { formatarTelefone } from "@/lib/telefone";

interface MotoristaData {
  id: string;
  nome: string;
  telefone: string;
  cpf: string;
  bairro_id: string;
  bairro_nome?: string;
  foto_url: string | null;
  user_id: string;
  placa: string | null;
  tipo_veiculo: string | null;
  marca_veiculo: string | null;
  cor_veiculo: string | null;
  aceita_pagamento: string;
}

export default function MotoristaPerfil() {
  const { user, signOut } = useAuth();
  const [data, setData] = useState<MotoristaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [telefone, setTelefone] = useState("");
  const [aceitaPagamento, setAceitaPagamento] = useState("ambos");

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const userEmail = user?.email || "";
  const storageUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/profile-photos`;

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: mot } = await supabase
        .from("motoristas")
        .select("id, nome, telefone, cpf, bairro_id, foto_url, user_id, placa, tipo_veiculo, marca_veiculo, cor_veiculo, aceita_pagamento, nota_referencia, bairros(nome)")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (mot) {
        const motData = mot as any;
        setData({ ...motData, bairro_nome: motData.bairros?.nome || "" } as MotoristaData);
        setTelefone(motData.telefone);
        setAceitaPagamento(motData.aceita_pagamento || "ambos");
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!data) return;
    if (!telefone.trim()) {
      toast.error("Preencha o telefone");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("motoristas")
      .update({ telefone: telefone.trim(), aceita_pagamento: aceitaPagamento })
      .eq("id", data.id);

    if (error) toast.error(error.message);
    else toast.success("Perfil atualizado!");
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (novaSenha.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (novaSenha !== confirmSenha) {
      toast.error("Senhas não coincidem");
      return;
    }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) toast.error(error.message);
    else {
      toast.success("Senha alterada com sucesso!");
      setNovaSenha("");
      setConfirmSenha("");
    }
    setSavingPwd(false);
  };

  if (loading) {
    return <div className="p-4 text-center text-sm text-muted-foreground animate-pulse">Carregando perfil...</div>;
  }

  if (!data) {
    return <div className="p-4 text-center text-sm text-muted-foreground">Perfil não encontrado</div>;
  }

  const fotoSrc = data.foto_url ? `${storageUrl}/${data.foto_url}` : null;

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      {/* Photo (read-only, from selfie) */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          {fotoSrc ? (
            <img src={fotoSrc} alt="Perfil" className="h-24 w-24 rounded-full object-cover border-4 border-primary/20" />
          ) : (
            <div className="h-24 w-24 rounded-full bg-secondary flex items-center justify-center border-4 border-primary/20">
              <User className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
        </div>
        <p className="font-semibold text-lg">{titleCase(data.nome)}</p>
        <StarRating nota={(data as any).nota_referencia ?? 5} size="md" />
        <p className="text-xs text-muted-foreground">A foto de perfil é vinculada à selfie do cadastro</p>
      </div>

      {/* Editable info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dados editáveis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={telefone} onChange={(e) => setTelefone(formatarTelefone(e.target.value))} maxLength={15} />
          </div>
          <div className="space-y-2">
            <Label>Aceitar pagamento</Label>
            <Select value={aceitaPagamento} onValueChange={setAceitaPagamento}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ambos">Dinheiro e PIX</SelectItem>
                <SelectItem value="dinheiro">Somente Dinheiro</SelectItem>
                <SelectItem value="pix">Somente PIX</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={userEmail} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">Para alterar o email, entre em contato com o administrador.</p>
          </div>
          <Button className="w-full" onClick={handleSaveProfile} disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </CardContent>
      </Card>

      {/* Read-only info */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Dados cadastrais (somente leitura)</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">Para alterar estes dados, solicite ao administrador.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={titleCase(data.nome)} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input value={data.cpf} disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input value={data.bairro_nome || ""} disabled className="bg-muted" />
          </div>

          {(data.placa || data.tipo_veiculo || data.marca_veiculo || data.cor_veiculo) && (
            <div className="border-t pt-4 mt-2 space-y-4">
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Veículo</span>
              </div>
              <div className="space-y-2">
                <Label>Placa</Label>
                <Input value={data.placa?.toUpperCase() || ""} disabled className="bg-muted" />
              </div>
              {data.tipo_veiculo && (
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Input value={titleCase(data.tipo_veiculo)} disabled className="bg-muted" />
                </div>
              )}
              {data.marca_veiculo && (
                <div className="space-y-2">
                  <Label>Marca</Label>
                  <Input value={titleCase(data.marca_veiculo)} disabled className="bg-muted" />
                </div>
              )}
              {data.cor_veiculo && (
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <Input value={titleCase(data.cor_veiculo)} disabled className="bg-muted" />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Alterar senha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <div className="space-y-2">
            <Label>Confirmar nova senha</Label>
            <Input type="password" value={confirmSenha} onChange={(e) => setConfirmSenha(e.target.value)} placeholder="Repita a senha" />
          </div>
          <Button variant="outline" className="w-full" onClick={handleChangePassword} disabled={savingPwd}>
            {savingPwd ? "Alterando..." : "Alterar senha"}
          </Button>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button variant="destructive" className="w-full" onClick={signOut}>
        <LogOut className="h-4 w-4 mr-2" /> Sair da conta
      </Button>
    </div>
  );
}
