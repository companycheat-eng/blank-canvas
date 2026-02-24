import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

export default function RedefinirSenhaPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("Senhas não coincidem");
      return;
    }
    if (!token) {
      toast.error("Token inválido. Solicite um novo link.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-password", {
        body: { token, password },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else {
        setDone(true);
        toast.success("Senha redefinida com sucesso!");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao redefinir senha");
    } finally {
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
          <CardTitle className="text-2xl">Redefinir Senha</CardTitle>
          <CardDescription>
            {done ? "Sua senha foi alterada" : "Crie uma nova senha para sua conta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!done ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nova senha</Label>
                <Input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Confirmar nova senha</Label>
                <Input
                  type="password"
                  placeholder="Repita a senha"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full h-12" disabled={loading}>
                {loading ? "Redefinindo..." : "Redefinir senha"}
              </Button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Você já pode fazer login com sua nova senha.
              </p>
              <Link to="/login">
                <Button className="w-full">Ir para o login</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
