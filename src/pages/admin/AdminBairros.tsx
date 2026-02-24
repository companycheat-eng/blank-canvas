import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { MapPin, Plus, Building2, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { PlacesAutocomplete } from "@/components/maps/PlacesAutocomplete";

interface Bairro {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  ativo: boolean;
  lat: number | null;
  lng: number | null;
  cidade_inteira: boolean;
}

export default function AdminBairros() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCidade, setNewCidade] = useState("");
  const [newEstado, setNewEstado] = useState("");
  const [newLat, setNewLat] = useState("");
  const [newLng, setNewLng] = useState("");
  const [adminNome, setAdminNome] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [locationTab, setLocationTab] = useState("google");
  const [newCidadeInteira, setNewCidadeInteira] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("bairros").select("*").order("nome");
    setBairros((data as Bairro[]) || []);
  };

  useEffect(() => { load(); }, []);

  const handlePlaceSelect = useCallback((place: { address: string; lat: number; lng: number; addressComponents?: google.maps.GeocoderAddressComponent[] }) => {
    setNewLat(String(place.lat));
    setNewLng(String(place.lng));

    if (place.addressComponents) {
      const comps = place.addressComponents;
      const getComp = (type: string) => comps.find(c => c.types.includes(type));

      // Bairro: sublocality_level_1 or sublocality or neighborhood
      const bairro = getComp("sublocality_level_1") || getComp("sublocality") || getComp("neighborhood");
      if (bairro && !newName) setNewName(bairro.long_name);

      // Cidade: administrative_area_level_2 or locality
      const cidade = getComp("administrative_area_level_2") || getComp("locality");
      if (cidade) setNewCidade(cidade.long_name);

      // Estado (sigla): administrative_area_level_1
      const estado = getComp("administrative_area_level_1");
      if (estado) setNewEstado(estado.short_name.toUpperCase());
    } else {
      // Fallback: parse from formatted address
      const parts = place.address.split(",").map(p => p.trim());
      if (parts.length >= 2 && !newName) {
        setNewName(parts.length >= 3 ? parts[1] : parts[0]);
      }
      if (parts.length >= 3) {
        const cidadeEstado = parts[2].trim();
        const match = cidadeEstado.match(/^(.+?)\s*-\s*(\w{2})$/);
        if (match) {
          setNewCidade(match[1].trim());
          setNewEstado(match[2].trim().toUpperCase());
        }
      }
    }
  }, [newName]);

  const resetForm = () => {
    setNewName("");
    setNewCidade("");
    setNewEstado("");
    setNewLat("");
    setNewLng("");
    setAdminNome("");
    setAdminEmail("");
    setAdminPassword("");
    setLocationTab("google");
    setNewCidadeInteira(false);
  };

  const createBairro = async () => {
    if (!newName.trim() || !newCidade.trim() || !newEstado.trim()) { toast.error("Preencha nome, cidade e estado"); return; }
    if (!adminEmail.trim() || !adminPassword.trim() || !adminNome.trim()) {
      toast.error("Preencha os dados do administrador do bairro");
      return;
    }
    if (adminPassword.length < 6) { toast.error("Senha deve ter pelo menos 6 caracteres"); return; }

    const lat = newLat ? parseFloat(newLat) : null;
    const lng = newLng ? parseFloat(newLng) : null;

    setCreating(true);
    try {
      const { data: bairroData, error: bairroErr } = await supabase
        .from("bairros")
        .insert({ nome: newName.trim(), cidade: newCidade.trim(), estado: newEstado.trim().toUpperCase(), lat, lng, cidade_inteira: newCidadeInteira })
        .select("id")
        .single();

      if (bairroErr) { toast.error(bairroErr.message); return; }

      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${baseUrl}/functions/v1/create-admin-bairro`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          email: adminEmail.trim(),
          password: adminPassword,
          nome: adminNome.trim(),
          bairro_id: bairroData.id,
        }),
      });

      const result = await res.json();
      if (!result.ok) {
        toast.error(`Bairro criado, mas erro ao criar admin: ${result.erro}`);
      } else {
        toast.success("Bairro e administrador criados com sucesso!");
      }

      resetForm();
      setShowCreate(false);
      load();
    } catch (err: any) {
      toast.error("Erro inesperado: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    const { error } = await supabase.from("bairros").update({ ativo: !ativo }).eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const deleteBairro = async (id: string) => {
    // Check for linked motoristas/clientes/corridas
    const [{ count: mCount }, { count: cCount }] = await Promise.all([
      supabase.from("motoristas").select("id", { count: "exact", head: true }).eq("bairro_id", id),
      supabase.from("clientes").select("id", { count: "exact", head: true }).eq("bairro_id", id),
    ]);
    if ((mCount || 0) > 0 || (cCount || 0) > 0) {
      toast.error(`Não é possível excluir: ${mCount || 0} motorista(s) e ${cCount || 0} cliente(s) vinculados. Desative-o em vez disso.`);
      return;
    }
    const { error } = await supabase.from("bairros").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Bairro excluído!"); load(); }
  };

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Bairros</h2>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo
        </Button>
      </div>

      <div className="space-y-3">
        {bairros.map((b) => (
          <Card key={b.id} className="shadow-sm cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate(`/admin/bairros/${b.id}`)}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">{b.nome}</p>
                   <p className="text-xs text-muted-foreground">
                     {b.cidade} - {b.estado}
                     {b.cidade_inteira && <span className="ml-1 text-primary/70">(cidade inteira)</span>}
                     {b.lat && b.lng && (
                       <span className="ml-2 text-primary/70">({b.lat.toFixed(4)}, {b.lng.toFixed(4)})</span>
                     )}
                   </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  className={b.ativo ? "bg-success text-success-foreground cursor-pointer" : "bg-destructive text-destructive-foreground cursor-pointer"}
                  onClick={(e) => { e.stopPropagation(); toggleAtivo(b.id, b.ativo); }}
                >
                  {b.ativo ? "Ativo" : "Inativo"}
                </Badge>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={(e) => e.stopPropagation()}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir bairro "{b.nome}"?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação não pode ser desfeita. Bairros com motoristas ou clientes vinculados não podem ser excluídos.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteBairro(b.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) resetForm(); setShowCreate(open); }} modal={false}>
        <DialogContent className="max-h-[90vh] overflow-y-auto fixed z-50" onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('.pac-container')) e.preventDefault();
        }}>
          <DialogHeader>
            <DialogTitle>Novo Bairro</DialogTitle>
            <DialogDescription>Crie o bairro e o administrador que vai gerenciá-lo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Tabs value={locationTab} onValueChange={setLocationTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="google">Buscar no Google</TabsTrigger>
                <TabsTrigger value="manual">Manual</TabsTrigger>
              </TabsList>

              <TabsContent value="google" className="space-y-3 mt-3">
                <div className="space-y-2">
                  <Label>Buscar localização</Label>
                  <div className="border rounded-md px-2 py-1">
                    <PlacesAutocomplete
                      placeholder="Digite o nome do bairro..."
                      onPlaceSelect={handlePlaceSelect}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="manual" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Latitude</Label>
                    <Input type="number" step="any" value={newLat} onChange={(e) => setNewLat(e.target.value)} placeholder="-23.5505" />
                  </div>
                  <div className="space-y-2">
                    <Label>Longitude</Label>
                    <Input type="number" step="any" value={newLng} onChange={(e) => setNewLng(e.target.value)} placeholder="-46.6333" />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label>Nome do bairro</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Vila Mariana" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={newCidade} onChange={(e) => setNewCidade(e.target.value)} placeholder="Ex: São Paulo" />
              </div>
              <div className="space-y-2">
                <Label>Estado (sigla)</Label>
                <Input value={newEstado} onChange={(e) => setNewEstado(e.target.value)} placeholder="Ex: SP" maxLength={2} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="cidadeInteira" checked={newCidadeInteira} onCheckedChange={(v) => setNewCidadeInteira(v === true)} />
              <Label htmlFor="cidadeInteira" className="text-sm cursor-pointer">Cidade inteira (sem subdivisão por bairro)</Label>
            </div>

            {(newLat && newLng) && (
              <p className="text-xs text-muted-foreground">
                📍 Coordenadas: {parseFloat(newLat).toFixed(6)}, {parseFloat(newLng).toFixed(6)}
              </p>
            )}

            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-muted-foreground mb-3">Administrador do Bairro</p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={adminNome} onChange={(e) => setAdminNome(e.target.value)} placeholder="Nome do admin" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@email.com" />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                </div>
              </div>
            </div>

            <Button className="w-full" onClick={createBairro} disabled={creating}>
              {creating ? "Criando..." : "Criar bairro e admin"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
