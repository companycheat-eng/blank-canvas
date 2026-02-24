import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Truck, Check, Camera, Car } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { BairroSelect } from "@/components/BairroSelect";
import { toast } from "@/components/ui/sonner";
import { validarCPF } from "@/lib/cpf";
import { formatarTelefone } from "@/lib/telefone";
import { CameraCapture } from "@/components/camera/CameraCapture";

type CaptureStep = null | "selfie" | "cnh" | "doc_veiculo";

export default function CadastroMotoristaPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [cnhFile, setCnhFile] = useState<File | null>(null);
  const [docVeiculoFile, setDocVeiculoFile] = useState<File | null>(null);
  const [captureStep, setCaptureStep] = useState<CaptureStep>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [cnhPreview, setCnhPreview] = useState<string | null>(null);
  const [docVeiculoPreview, setDocVeiculoPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    telefone: "",
    email: "",
    senha: "",
    bairro_id: "",
    placa: "",
  });

  const uploadFile = async (userId: string, file: File, type: string) => {
    const ext = file.name.split(".").pop();
    const path = `${userId}/${type}.${ext}`;
    const { error } = await supabase.storage.from("kyc-documents").upload(path, file);
    if (error) throw error;
    return path;
  };

  const handleSelfieCapture = (file: File) => {
    setSelfieFile(file);
    setSelfiePreview(URL.createObjectURL(file));
    setCaptureStep(null);
  };

  const handleCnhCapture = (file: File) => {
    setCnhFile(file);
    setCnhPreview(URL.createObjectURL(file));
    setCaptureStep(null);
  };

  const handleDocVeiculoCapture = (file: File) => {
    setDocVeiculoFile(file);
    setDocVeiculoPreview(URL.createObjectURL(file));
    setCaptureStep(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cpfLimpo = form.cpf.replace(/\D/g, "");

    if (!validarCPF(cpfLimpo)) { toast.error("CPF inválido"); return; }
    if (!form.bairro_id) { toast.error("Selecione um bairro"); return; }
    if (!selfieFile) { toast.error("Tire sua selfie"); return; }
    if (!cnhFile) { toast.error("Tire a foto da CNH"); return; }
    if (!docVeiculoFile) { toast.error("Tire a foto do documento do veículo"); return; }
    if (!form.placa.trim()) { toast.error("Informe a placa do veículo"); return; }

    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.senha,
      options: { emailRedirectTo: window.location.origin },
    });

    if (authError || !authData.user) {
      const msg = authError?.message || "Erro ao criar conta";
      if (msg.includes("already registered")) {
        toast.error("Este email já está cadastrado. Faça login.");
      } else {
        toast.error(msg);
      }
      setLoading(false);
      return;
    }

    try {
      const selfiePath = await uploadFile(authData.user.id, selfieFile, "selfie");
      const cnhPath = await uploadFile(authData.user.id, cnhFile, "cnh");
      const docVeiculoPath = await uploadFile(authData.user.id, docVeiculoFile!, "doc-veiculo");

      // Upload selfie also as profile photo
      const selfieExt = selfieFile.name.split(".").pop() || "jpg";
      const profilePath = `${authData.user.id}/profile.${selfieExt}`;
      await supabase.storage.from("profile-photos").upload(profilePath, selfieFile, { upsert: true });

      const { error: profileError } = await supabase.from("motoristas").insert({
        user_id: authData.user.id,
        cpf: cpfLimpo,
        nome: form.nome,
        telefone: form.telefone.replace(/\D/g, ""),
        bairro_id: form.bairro_id,
        selfie_url: selfiePath,
        cnh_url: cnhPath,
        doc_veiculo_url: docVeiculoPath,
        foto_url: profilePath,
        placa: form.placa.toUpperCase().trim(),
      });

      if (profileError) {
        const msg = profileError.message || "";
        if (msg.includes("motoristas_cpf_key") || msg.includes("duplicate key") && msg.includes("cpf")) {
          toast.error("Este CPF já está cadastrado.");
        } else if (msg.includes("motoristas_telefone_key") || msg.includes("duplicate key") && msg.includes("telefone")) {
          toast.error("Este telefone já está cadastrado.");
        } else {
          throw profileError;
        }
        setLoading(false);
        return;
      }

      toast.success("Cadastro enviado! Aguarde aprovação do KYC.");
      navigate("/login");
    } catch (err: any) {
      const errMsg = err.message || "Erro ao finalizar cadastro";
      if (errMsg.includes("motoristas_cpf_key")) {
        toast.error("Este CPF já está cadastrado.");
      } else if (errMsg.includes("motoristas_telefone_key")) {
        toast.error("Este telefone já está cadastrado.");
      } else {
        toast.error(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Show camera capture full screen
  if (captureStep) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="max-w-md mx-auto">
          <CameraCapture
            mode={captureStep === "selfie" ? "selfie" : "document"}
            label={
              captureStep === "selfie"
                ? "Tire uma selfie — enquadre seu rosto"
                : captureStep === "cnh"
                ? "Fotografe sua CNH — enquadre o documento"
                : "Fotografe o documento do veículo (CRLV)"
            }
            onCapture={
              captureStep === "selfie"
                ? handleSelfieCapture
                : captureStep === "cnh"
                ? handleCnhCapture
                : handleDocVeiculoCapture
            }
            onCancel={() => setCaptureStep(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Truck className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Cadastro Motorista</CardTitle>
          <CardDescription>Cadastre-se para fazer carretos</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input placeholder="Seu nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
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
              <Label>Email</Label>
              <Input type="email" placeholder="seu@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input type="password" placeholder="Mínimo 6 caracteres" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required minLength={6} />
            </div>
            <BairroSelect
              value={form.bairro_id}
              onValueChange={(v) => setForm({ ...form, bairro_id: v })}
            />

            {/* Vehicle info */}
            <div className="border-t pt-4 mt-2">
              <div className="flex items-center gap-2 mb-3">
                <Car className="h-5 w-5 text-primary" />
                <h4 className="font-semibold text-sm">Dados do veículo</h4>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Placa</Label>
                  <Input placeholder="ABC-1234" value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value })} required />
                </div>
                <p className="text-xs text-muted-foreground">As demais informações do veículo serão preenchidas pelo administrador após análise do CRLV.</p>
              </div>
            </div>

            {/* Selfie capture */}
            <div className="space-y-2">
              <Label>Selfie</Label>
              {selfiePreview ? (
                <div className="flex items-center gap-3">
                  <img src={selfiePreview} alt="Selfie" className="h-16 w-16 rounded-lg object-cover" />
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">Capturada</span>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCaptureStep("selfie")}>
                    Tirar outra
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="w-full h-12" onClick={() => setCaptureStep("selfie")}>
                  <Camera className="h-5 w-5 mr-2" /> Tirar selfie
                </Button>
              )}
            </div>

            {/* CNH capture */}
            <div className="space-y-2">
              <Label>Foto CNH</Label>
              {cnhPreview ? (
                <div className="flex items-center gap-3">
                  <img src={cnhPreview} alt="CNH" className="h-16 w-16 rounded-lg object-cover" />
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">Capturada</span>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCaptureStep("cnh")}>
                    Tirar outra
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="w-full h-12" onClick={() => setCaptureStep("cnh")}>
                  <Camera className="h-5 w-5 mr-2" /> Fotografar CNH
                </Button>
              )}
            </div>

            {/* Vehicle document capture */}
            <div className="space-y-2">
              <Label>Documento do veículo (CRLV)</Label>
              {docVeiculoPreview ? (
                <div className="flex items-center gap-3">
                  <img src={docVeiculoPreview} alt="Doc Veículo" className="h-16 w-16 rounded-lg object-cover" />
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">Capturada</span>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCaptureStep("doc_veiculo")}>
                    Tirar outra
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="w-full h-12" onClick={() => setCaptureStep("doc_veiculo")}>
                  <Camera className="h-5 w-5 mr-2" /> Fotografar documento do veículo
                </Button>
              )}
            </div>

            <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
              {loading ? "Enviando..." : "Cadastrar"}
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
