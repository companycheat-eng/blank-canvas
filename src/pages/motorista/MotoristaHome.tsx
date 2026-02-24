import { useState } from "react";
import { Navigate } from "react-router-dom";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Map, Wallet, Clock, User } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import { SuporteDrawer } from "@/components/suporte/SuporteDrawer";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { to: "/motorista", icon: Map, label: "Mapa" },
  { to: "/motorista/carteira", icon: Wallet, label: "Carteira" },
  { to: "/motorista/historico", icon: Clock, label: "Histórico" },
  { to: "/motorista/perfil", icon: User, label: "Perfil" },
];

export default function MotoristaHome() {
  const { userType, loading } = useAuth();
  const [suporteOpen, setSuporteOpen] = useState(false);
  const location = useLocation();
  const isMapPage = location.pathname === "/motorista";

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary text-lg">Carregando...</div></div>;

  if (userType !== "motorista") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className={`bg-background ${isMapPage ? "overflow-hidden" : "min-h-screen"}`} style={isMapPage ? { height: '100dvh' } : undefined}>
      <AppTopBar title="Carreto Motorista" showSuporteButton onSuporteClick={() => setSuporteOpen(true)} />
      <main className="pt-14 pb-16">
        <Outlet />
      </main>
      <SuporteDrawer userTipo="motorista" open={suporteOpen} onOpenChange={setSuporteOpen} />
      <BottomNav items={navItems} />
    </div>
  );
}
