import { useState } from "react";
import { Link } from "react-router-dom";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { formatarTelefone } from "@/lib/telefone";
import { supabase } from "@/integrations/supabase/client";

export default function EsqueciSenhaPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 11 || digits[2] !== "9") {
      toast.error("Telefone inválido. Use DDD + 9 + 8 dígitos");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-password-reset", {
        body: { phone: digits },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else {
        setSent(true);
        toast.success("Se o número estiver cadastrado, um link foi enviado por email.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar solicitação");
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
          <CardTitle className="text-2xl">Recuperar Senha</CardTitle>
          <CardDescription>
            {sent
              ? "Verifique o email vinculado ao seu cadastro"
              : "Informe seu telefone para receber o link de redefinição"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone cadastrado</Label>
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
              <Button type="submit" className="w-full h-12" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link de redefinição"}
              </Button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Se houver uma conta associada a este telefone, enviamos um email com instruções para redefinir sua senha.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
                Tentar novamente
              </Button>
            </div>
          )}
          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-primary font-medium hover:underline">
              Voltar ao login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
