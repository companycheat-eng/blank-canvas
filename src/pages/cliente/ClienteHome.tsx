import { useState } from "react";
import { Navigate } from "react-router-dom";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Map, Clock, User } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import { SuporteDrawer } from "@/components/suporte/SuporteDrawer";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { to: "/cliente", icon: Map, label: "Mapa" },
  { to: "/cliente/historico", icon: Clock, label: "Histórico" },
  { to: "/cliente/perfil", icon: User, label: "Perfil" },
];

export default function ClienteHome() {
  const { userType, loading } = useAuth();
  const [suporteOpen, setSuporteOpen] = useState(false);
  const location = useLocation();
  const isMapPage = location.pathname === "/cliente";

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary text-lg">Carregando...</div></div>;

  if (userType !== "cliente") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className={`bg-background ${isMapPage ? "overflow-hidden" : "min-h-screen"}`} style={isMapPage ? { height: '100dvh' } : undefined}>
      <AppTopBar title="Carreto App" showSuporteButton onSuporteClick={() => setSuporteOpen(true)} />
      <main className="pt-14 pb-16">
        <Outlet />
      </main>
      <SuporteDrawer userTipo="cliente" open={suporteOpen} onOpenChange={setSuporteOpen} />
      <BottomNav items={navItems} />
    </div>
  );
}
