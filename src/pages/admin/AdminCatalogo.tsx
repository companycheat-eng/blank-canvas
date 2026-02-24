import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Package, Plus, Pencil, FolderOpen, Search, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Categoria {
  id: string;
  nome: string;
  icone: string;
  ordem: number;
  ativo: boolean;
}

interface Item {
  id: string;
  nome: string;
  icone: string;
  preco_base: number;
  ativo: boolean;
  categoria_id: string | null;
}

export default function AdminCatalogo() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [itemForm, setItemForm] = useState({ nome: "", icone: "package", preco_base: "", categoria_id: "" });
  const [showCatForm, setShowCatForm] = useState(false);
  const [editCat, setEditCat] = useState<Categoria | null>(null);
  const [catForm, setCatForm] = useState({ nome: "", icone: "package", ordem: "0" });
  const [searchItem, setSearchItem] = useState("");

  const load = async () => {
    const [{ data: catData }, { data: itensData }] = await Promise.all([
      supabase.from("categorias_itens").select("*").order("ordem"),
      supabase.from("itens_global").select("*").order("nome"),
    ]);
    setCategorias((catData as Categoria[]) || []);
    setItens((itensData as Item[]) || []);
  };

  useEffect(() => { load(); }, []);

  // Category CRUD
  const openCatCreate = () => {
    setEditCat(null);
    setCatForm({ nome: "", icone: "package", ordem: "0" });
    setShowCatForm(true);
  };

  const openCatEdit = (cat: Categoria) => {
    setEditCat(cat);
    setCatForm({ nome: cat.nome, icone: cat.icone, ordem: String(cat.ordem) });
    setShowCatForm(true);
  };

  const saveCat = async () => {
    if (!catForm.nome.trim()) { toast.error("Informe o nome"); return; }
    const data = { nome: catForm.nome.trim(), icone: catForm.icone, ordem: parseInt(catForm.ordem) || 0 };

    if (editCat) {
      const { error } = await supabase.from("categorias_itens").update(data).eq("id", editCat.id);
      if (error) toast.error(error.message);
      else { toast.success("Categoria atualizada!"); setShowCatForm(false); load(); }
    } else {
      const { error } = await supabase.from("categorias_itens").insert(data);
      if (error) toast.error(error.message);
      else { toast.success("Categoria criada!"); setShowCatForm(false); load(); }
    }
  };

  // Item CRUD
  const openItemCreate = () => {
    setEditItem(null);
    setItemForm({ nome: "", icone: "package", preco_base: "", categoria_id: "" });
    setShowItemForm(true);
  };

  const openItemEdit = (item: Item) => {
    setEditItem(item);
    setItemForm({ nome: item.nome, icone: item.icone, preco_base: String(item.preco_base), categoria_id: item.categoria_id || "" });
    setShowItemForm(true);
  };

  const saveItem = async () => {
    if (!itemForm.nome.trim() || !itemForm.preco_base) { toast.error("Preencha todos os campos"); return; }
    const data: any = {
      nome: itemForm.nome.trim(),
      icone: itemForm.icone,
      preco_base: parseFloat(itemForm.preco_base),
      categoria_id: itemForm.categoria_id || null,
    };

    if (editItem) {
      const { error } = await supabase.from("itens_global").update(data).eq("id", editItem.id);
      if (error) toast.error(error.message);
      else { toast.success("Item atualizado!"); setShowItemForm(false); load(); }
    } else {
      const { error } = await supabase.from("itens_global").insert(data);
      if (error) toast.error(error.message);
      else { toast.success("Item criado!"); setShowItemForm(false); load(); }
    }
  };

  const deleteItem = async (id: string) => {
    const { count } = await supabase.from("corrida_itens").select("id", { count: "exact", head: true }).eq("item_id", id);
    if ((count || 0) > 0) {
      toast.error("Item vinculado a corridas. Desative-o em vez de excluir.");
      return;
    }
    const { error } = await supabase.from("itens_global").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Item excluído!"); load(); }
  };

  const deleteCat = async (id: string) => {
    const hasItems = itens.some(i => i.categoria_id === id);
    if (hasItems) {
      toast.error("Categoria possui itens vinculados. Remova os itens primeiro.");
      return;
    }
    const { error } = await supabase.from("categorias_itens").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Categoria excluída!"); load(); }
  };

  const getCatNome = (catId: string | null) => categorias.find((c) => c.id === catId)?.nome || "Sem categoria";

  const filteredItens = searchItem.trim()
    ? itens.filter((i) => i.nome.toLowerCase().includes(searchItem.toLowerCase()))
    : itens;

  // Group items by category
  const groupedItems = categorias
    .filter((c) => c.ativo)
    .map((cat) => ({
      ...cat,
      items: filteredItens.filter((i) => i.categoria_id === cat.id),
    }))
    .concat([{
      id: "__none",
      nome: "Sem categoria",
      icone: "package",
      ordem: 999,
      ativo: true,
      items: filteredItens.filter((i) => !i.categoria_id),
    } as any])
    .filter((g: any) => g.items.length > 0);

  return (
    <div className="space-y-4 py-4">
      <Tabs defaultValue="itens">
        <TabsList className="w-full">
          <TabsTrigger value="itens" className="flex-1">Itens</TabsTrigger>
          <TabsTrigger value="categorias" className="flex-1">Categorias</TabsTrigger>
        </TabsList>

        {/* Itens Tab */}
        <TabsContent value="itens" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Catálogo de Itens</h2>
            <Button size="sm" onClick={openItemCreate}><Plus className="h-4 w-4 mr-1" /> Novo Item</Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar item por nome..."
              value={searchItem}
              onChange={(e) => setSearchItem(e.target.value)}
              className="pl-9"
            />
          </div>

          {groupedItems.map((group: any) => (
            <div key={group.id} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <FolderOpen className="h-4 w-4" /> {group.nome}
              </h3>
              {group.items.map((item: Item) => (
                <Card key={item.id} className="shadow-sm">
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">{item.nome}</p>
                        <p className="text-xs text-muted-foreground">R$ {Number(item.preco_base).toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openItemEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir "{item.nome}"?</AlertDialogTitle>
                            <AlertDialogDescription>Itens vinculados a corridas não podem ser excluídos.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteItem(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </TabsContent>

        {/* Categorias Tab */}
        <TabsContent value="categorias" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Categorias</h2>
            <Button size="sm" onClick={openCatCreate}><Plus className="h-4 w-4 mr-1" /> Nova</Button>
          </div>

          {categorias.map((cat) => (
            <Card key={cat.id} className="shadow-sm">
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">{cat.nome}</p>
                    <p className="text-xs text-muted-foreground">Ordem: {cat.ordem}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={cat.ativo ? "default" : "secondary"}>{cat.ativo ? "Ativo" : "Inativo"}</Badge>
                  <Button size="icon" variant="ghost" onClick={() => openCatEdit(cat)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir categoria "{cat.nome}"?</AlertDialogTitle>
                        <AlertDialogDescription>Categorias com itens vinculados não podem ser excluídas.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteCat(cat.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Item form dialog */}
      <Dialog open={showItemForm} onOpenChange={setShowItemForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar Item" : "Novo Item"}</DialogTitle>
            <DialogDescription>Gerencie os itens do catálogo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={itemForm.nome} onChange={(e) => setItemForm({ ...itemForm, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={itemForm.categoria_id}
                onChange={(e) => setItemForm({ ...itemForm, categoria_id: e.target.value })}
              >
                <option value="">Sem categoria</option>
                {categorias.filter((c) => c.ativo).map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Preço base (R$)</Label>
              <Input type="number" step="0.01" value={itemForm.preco_base} onChange={(e) => setItemForm({ ...itemForm, preco_base: e.target.value })} />
            </div>
            <Button className="w-full" onClick={saveItem}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category form dialog */}
      <Dialog open={showCatForm} onOpenChange={setShowCatForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editCat ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
            <DialogDescription>Gerencie as categorias de itens</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={catForm.nome} onChange={(e) => setCatForm({ ...catForm, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Ordem de exibição</Label>
              <Input type="number" value={catForm.ordem} onChange={(e) => setCatForm({ ...catForm, ordem: e.target.value })} />
            </div>
            <Button className="w-full" onClick={saveCat}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
