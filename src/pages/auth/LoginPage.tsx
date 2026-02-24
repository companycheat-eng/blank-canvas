import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { formatarTelefone } from "@/lib/telefone";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, userType, loading: authLoading } = useAuth();
  const [phone, setPhone] = useState("");
  const [phonePro, setPhonePro] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("cliente");

  // Redirect when auth state changes (after successful login)
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    switch (userType) {
      case "admin_geral":
      case "admin_bairro":
        navigate("/admin", { replace: true });
        break;
      case "suporte":
        navigate("/suporte", { replace: true });
        break;
      case "motorista":
        navigate("/motorista", { replace: true });
        break;
      case "cliente":
        navigate("/cliente", { replace: true });
        break;
      default:
        // userType still null — wait
        break;
    }
  }, [user, userType, authLoading, navigate]);

  const doLogin = async (loginEmail: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ email: loginEmail, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.access_token) {
        const rawMsg = data.error_description || data.msg || "";
        let msg = "Credenciais incorretas. Verifique e tente novamente.";
        if (rawMsg.toLowerCase().includes("invalid login credentials")) {
          msg = "Credenciais incorretas. Verifique telefone/email e senha.";
        } else if (rawMsg.toLowerCase().includes("email not confirmed")) {
          msg = "Email não confirmado. Verifique sua caixa de entrada.";
        } else if (rawMsg) {
          msg = rawMsg;
        }
        toast.error(msg);
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (error) {
        toast.error("Erro ao iniciar sessão: " + error.message);
        setLoading(false);
        return;
      }

      toast.success("Login realizado!");
      // Navigation is handled by the useEffect above reacting to auth state
    } catch (err) {
      toast.error("Erro inesperado. Tente novamente.");
      setLoading(false);
    }
  };

  const handleClienteLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const phoneLimpo = phone.replace(/\D/g, "");
    if (phoneLimpo.length !== 11 || phoneLimpo[2] !== "9") {
      toast.error("Telefone inválido. Use DDD + 9 + 8 dígitos");
      return;
    }
    await doLogin(`${phoneLimpo}@carreto.app`);
  };

  const handleProfissionalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = phonePro.trim();
    // If it looks like an email, use it directly
    if (input.includes("@")) {
      await doLogin(input);
      return;
    }
    // Otherwise treat as phone number - resolve auth email via edge function
    const digitsOnly = input.replace(/\D/g, "");
    if (digitsOnly.length !== 11 || digitsOnly[2] !== "9") {
      toast.error("Telefone inválido. Use DDD + 9 + 8 dígitos");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/find-user-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ phone: digitsOnly, user_type: "motorista" }),
      });
      const data = await res.json();
      if (data.email) {
        await doLogin(data.email);
      } else {
        toast.error("Usuário não encontrado");
        setLoading(false);
      }
    } catch {
      toast.error("Erro ao buscar usuário. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Truck className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Carreto App</CardTitle>
          <CardDescription>Entre na sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="cliente">Cliente</TabsTrigger>
              <TabsTrigger value="profissional">Motorista</TabsTrigger>
            </TabsList>

            <TabsContent value="cliente">
              <form onSubmit={handleClienteLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(71) 90000-0000"
                    value={phone}
                    onChange={(e) => setPhone(formatarTelefone(e.target.value))}
                    maxLength={15}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-cli">Senha</Label>
                  <Input
                    id="password-cli"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="profissional">
              <form onSubmit={handleProfissionalLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone-pro">Telefone ou Email</Label>
                  <Input
                    id="phone-pro"
                    type="text"
                    placeholder="(71) 90000-0000 ou email@exemplo.com"
                    value={phonePro}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/[a-zA-Z@]/.test(val)) {
                        setPhonePro(val);
                      } else {
                        setPhonePro(formatarTelefone(val));
                      }
                    }}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-pro">Senha</Label>
                  <Input
                    id="password-pro"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              <Link to="/esqueci-senha" className="text-primary font-medium hover:underline">
                Esqueci minha senha
              </Link>
            </p>
            <p className="text-sm text-muted-foreground">
              Não tem conta?{" "}
              <Link to="/cadastro/cliente" className="text-primary font-medium hover:underline">
                Cadastre-se como Cliente
              </Link>
            </p>
            <p className="text-sm text-muted-foreground">
              Faz carreto?{" "}
              <Link to="/cadastro/motorista" className="text-primary font-medium hover:underline">
                Cadastre-se como Motorista
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
