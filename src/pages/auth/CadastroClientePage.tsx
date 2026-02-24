import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BairroSelect } from "@/components/BairroSelect";
import { toast } from "@/components/ui/sonner";
import { validarCPF } from "@/lib/cpf";
import { formatarTelefone, validarTelefone } from "@/lib/telefone";

export default function CadastroClientePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    telefone: "",
    senha: "",
    bairro_id: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cpfLimpo = form.cpf.replace(/\D/g, "");

    if (!validarCPF(cpfLimpo)) {
      toast.error("CPF inválido");
      return;
    }
    if (!form.bairro_id) {
      toast.error("Selecione um bairro");
      return;
    }

    if (!validarTelefone(form.telefone)) {
      toast.error("Telefone inválido. Use DDD + 9 + 8 dígitos (ex: 71900000000)");
      return;
    }

    setLoading(true);
    const telefoneLimpo = form.telefone.replace(/\D/g, "");

    // Use phone as fake email for auth (phone@carreto.app)
    const fakeEmail = `${telefoneLimpo}@carreto.app`;

    try {
      const signUpRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          email: fakeEmail,
          password: form.senha,
        }),
      });

      const signUpData = await signUpRes.json();
      console.log("[Cadastro] Signup response:", signUpRes.status, signUpData);

      if (!signUpRes.ok || !signUpData.access_token || !signUpData.user?.id) {
        const msg = signUpData.msg || signUpData.error_description || signUpData.message || "Erro ao criar conta";
        toast.error(msg.includes("already registered") ? "Este telefone já está cadastrado" : msg);
        setLoading(false);
        return;
      }

      const userId = signUpData.user.id;
      const accessToken = signUpData.access_token;

      const insertRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/clientes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          user_id: userId,
          cpf: cpfLimpo,
          telefone: telefoneLimpo,
          nome: form.nome,
          bairro_id: form.bairro_id,
        }),
      });


      if (!insertRes.ok) {
        const errBody = await insertRes.json().catch(() => ({}));
        toast.error("Erro ao salvar perfil: " + (errBody.message || insertRes.statusText));
        setLoading(false);
        return;
      }

      // Now set the session in supabase client
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: signUpData.refresh_token,
      });

      toast.success("Conta criada com sucesso!");
      navigate("/");
    } catch (err) {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Truck className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Cadastro Cliente</CardTitle>
          <CardDescription>Crie sua conta para solicitar carretos</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input placeholder="Seu nome completo" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input placeholder="000.000.000-00" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input placeholder="(71) 90000-0000" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: formatarTelefone(e.target.value) })} required maxLength={15} />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input type="password" placeholder="Mínimo 6 caracteres" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required minLength={6} />
            </div>
            <BairroSelect
              value={form.bairro_id}
              onValueChange={(v) => setForm({ ...form, bairro_id: v })}
            />
            <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
              {loading ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
