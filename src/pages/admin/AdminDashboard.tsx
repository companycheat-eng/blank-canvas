import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, MapPin, Truck, CreditCard, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminDashboard() {
  const { userType } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ motoristas: 0, clientes: 0, corridas: 0, bairros: 0, motoristasOnline: 0, corridasAtivas: 0 });

  useEffect(() => {
    const loadStats = async () => {
      const [motoristas, clientes, corridas, bairros, online, ativas] = await Promise.all([
        supabase.from("motoristas").select("id", { count: "exact", head: true }),
        supabase.from("clientes").select("id", { count: "exact", head: true }),
        supabase.from("corridas").select("id", { count: "exact", head: true }),
        supabase.from("bairros").select("id", { count: "exact", head: true }),
        supabase.from("motoristas").select("id", { count: "exact", head: true }).eq("status_online", "online"),
        supabase.from("corridas").select("id", { count: "exact", head: true }).in("status", ["buscando", "aceita", "a_caminho", "chegou", "carregando", "em_deslocamento"]),
      ]);

      setStats({
        motoristas: motoristas.count || 0,
        clientes: clientes.count || 0,
        corridas: corridas.count || 0,
        bairros: bairros.count || 0,
        motoristasOnline: online.count || 0,
        corridasAtivas: ativas.count || 0,
      });
    };
    loadStats();
  }, []);

  const cards = [
    { title: "Motoristas", value: stats.motoristas, icon: Truck, color: "text-primary" },
    { title: "Online agora", value: stats.motoristasOnline, icon: Users, color: "text-success" },
    { title: "Clientes", value: stats.clientes, icon: Users, color: "text-accent" },
    { title: "Corridas ativas", value: stats.corridasAtivas, icon: CreditCard, color: "text-warning" },
    { title: "Total corridas", value: stats.corridas, icon: CreditCard, color: "text-primary" },
    ...(userType === "admin_geral" ? [{ title: "Bairros", value: stats.bairros, icon: MapPin, color: "text-accent" }] : []),
  ];

  return (
    <div className="space-y-6 py-4">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      <Button variant="outline" className="w-full justify-between h-12" onClick={() => navigate("/admin/faturamento")}>
        <span className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          <span className="font-semibold">Faturamento</span>
        </span>
        <span className="text-muted-foreground text-sm">Ver detalhes →</span>
      </Button>

      <div className="grid grid-cols-2 gap-4">
        {cards.map((card) => (
          <Card key={card.title} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
