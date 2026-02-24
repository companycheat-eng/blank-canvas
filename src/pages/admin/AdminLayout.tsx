import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { LayoutDashboard, MapPin, Settings, Package, ClipboardList } from "lucide-react";

export default function AdminLayout() {
  const { userType, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary text-lg">Carregando...</div></div>;

  if (userType !== "admin_geral" && userType !== "admin_bairro") {
    return <Navigate to="/login" replace />;
  }

  const isGeral = userType === "admin_geral";

  const navItems = [
    { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/admin/cadastros", icon: ClipboardList, label: "Cadastros" },
    ...(isGeral ? [{ to: "/admin/bairros", icon: MapPin, label: "Bairros" }] : []),
    { to: "/admin/catalogo", icon: Package, label: "Catálogo" },
    { to: "/admin/config", icon: Settings, label: "Config" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppTopBar title={isGeral ? "Admin Geral" : "Admin Bairro"} variant="admin" />
      <main className="pt-14 pb-20 px-4">
        <Outlet />
      </main>
      <BottomNav items={navItems} />
    </div>
  );
}
