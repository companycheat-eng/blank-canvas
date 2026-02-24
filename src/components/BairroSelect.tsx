import { useState, useEffect, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Bairro {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  cidade_inteira: boolean;
}

interface BairroSelectProps {
  value: string;
  onValueChange: (bairroId: string) => void;
}

export function BairroSelect({ value, onValueChange }: BairroSelectProps) {
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [estado, setEstado] = useState("");
  const [cidade, setCidade] = useState("");
  const [cidadeOpen, setCidadeOpen] = useState(false);
  const [bairroOpen, setBairroOpen] = useState(false);

  useEffect(() => {
    supabase
      .from("bairros")
      .select("id, nome, cidade, estado, cidade_inteira")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => setBairros(data || []));
  }, []);

  const estados = useMemo(
    () => [...new Set(bairros.map((b) => b.estado))].sort(),
    [bairros]
  );

  const cidades = useMemo(
    () =>
      estado
        ? [...new Set(bairros.filter((b) => b.estado === estado).map((b) => b.cidade))].sort()
        : [],
    [bairros, estado]
  );

  const bairrosFiltrados = useMemo(
    () =>
      estado && cidade
        ? bairros.filter((b) => b.estado === estado && b.cidade === cidade)
        : [],
    [bairros, estado, cidade]
  );

  const handleEstadoChange = (v: string) => {
    setEstado(v);
    setCidade("");
    onValueChange("");
  };

  const handleCidadeChange = (v: string) => {
    setCidade(v);
    setCidadeOpen(false);
    onValueChange("");
    const filtered = bairros.filter((b) => b.estado === estado && b.cidade === v);
    if (filtered.length === 1 && filtered[0].cidade_inteira) {
      onValueChange(filtered[0].id);
    }
  };

  const handleBairroChange = (bairroId: string) => {
    onValueChange(bairroId);
    setBairroOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Estado</Label>
        <Select value={estado} onValueChange={handleEstadoChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o estado" />
          </SelectTrigger>
          <SelectContent>
            {estados.map((e) => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {estado && (
        <div className="space-y-2">
          <Label>Cidade</Label>
          <Popover open={cidadeOpen} onOpenChange={setCidadeOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={cidadeOpen} className="w-full justify-between font-normal">
                {cidade || "Selecione a cidade"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar cidade..." />
                <CommandList>
                  <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
                  <CommandGroup>
                    {cidades.map((c) => (
                      <CommandItem key={c} value={c} onSelect={() => handleCidadeChange(c)}>
                        <Check className={cn("mr-2 h-4 w-4", cidade === c ? "opacity-100" : "opacity-0")} />
                        {c}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {cidade && (() => {
        const autoSelected = bairrosFiltrados.length === 1 && bairrosFiltrados[0].cidade_inteira;
        if (autoSelected) {
          return (
            <p className="text-xs text-muted-foreground">✅ Cidade inteira selecionada automaticamente</p>
          );
        }
        return (
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Popover open={bairroOpen} onOpenChange={setBairroOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={bairroOpen} className="w-full justify-between font-normal">
                  {bairrosFiltrados.find((b) => b.id === value)?.nome || "Selecione o bairro"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar bairro..." />
                  <CommandList>
                    <CommandEmpty>Nenhum bairro encontrado.</CommandEmpty>
                    <CommandGroup>
                      {bairrosFiltrados.map((b) => (
                        <CommandItem key={b.id} value={b.nome} onSelect={() => handleBairroChange(b.id)}>
                          <Check className={cn("mr-2 h-4 w-4", value === b.id ? "opacity-100" : "opacity-0")} />
                          {b.nome}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        );
      })()}
    </div>
  );
}
