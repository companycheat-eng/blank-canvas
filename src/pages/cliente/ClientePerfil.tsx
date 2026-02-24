import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Camera, User, Loader2, LogOut } from "lucide-react";
import { titleCase } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BairroSelect } from "@/components/BairroSelect";
import { toast } from "@/components/ui/sonner";
import { formatarTelefone } from "@/lib/telefone";

interface ClienteData {
  id: string;
  nome: string;
  telefone: string;
  cpf: string;
  email: string;
  bairro_id: string;
  foto_url: string | null;
  user_id: string;
}

export default function ClientePerfil() {
  const { user, signOut } = useAuth();
  const [data, setData] = useState<ClienteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [bairroId, setBairroId] = useState("");

  // Password fields
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const storageUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/profile-photos`;

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: cli } = await supabase
        .from("clientes")
        .select("id, nome, telefone, cpf, email, bairro_id, foto_url, user_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (cli) {
        setData(cli as ClienteData);
        setNome(cli.nome);
        setTelefone(cli.telefone);
        setEmail(cli.email || "");
        setBairroId(cli.bairro_id);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleUploadPhoto = async (file: File) => {
    if (!data || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/profile.${ext}`;
      
      // Remove old photo if exists
      if (data.foto_url) {
        await supabase.storage.from("profile-photos").remove([data.foto_url]);
      }

      const { error: upErr } = await supabase.storage.from("profile-photos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from("clientes").update({ foto_url: path }).eq("id", data.id);
      if (dbErr) throw dbErr;

      setData((prev) => prev ? { ...prev, foto_url: path } : prev);
      toast.success("Foto atualizada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar foto");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!data) return;
    if (!nome.trim() || !telefone.trim()) {
      toast.error("Preencha nome e telefone");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("clientes")
      .update({ nome: nome.trim(), telefone: telefone.trim(), email: email.trim(), bairro_id: bairroId })
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
      {/* Photo */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          {fotoSrc ? (
            <img src={fotoSrc} alt="Perfil" className="h-24 w-24 rounded-full object-cover border-4 border-primary/20" />
          ) : (
            <div className="h-24 w-24 rounded-full bg-secondary flex items-center justify-center border-4 border-primary/20">
              <User className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
          <button
            className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUploadPhoto(e.target.files[0])}
          />
        </div>
        <p className="font-semibold text-lg">{titleCase(data.nome)}</p>
      </div>

      {/* Profile info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={telefone} onChange={(e) => setTelefone(formatarTelefone(e.target.value))} maxLength={15} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input value={data.cpf} disabled className="bg-muted" />
          </div>
          <BairroSelect value={bairroId} onValueChange={setBairroId} />
          <Button className="w-full" onClick={handleSaveProfile} disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
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
