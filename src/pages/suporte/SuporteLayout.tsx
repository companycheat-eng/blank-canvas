import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { MessageSquare, Inbox } from "lucide-react";

export default function SuporteLayout() {
  const { userType, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary text-lg">Carregando...</div></div>;

  if (userType !== "suporte" && userType !== "admin_geral") {
    return <Navigate to="/login" replace />;
  }

  const navItems = [
    { to: "/suporte", icon: Inbox, label: "Tickets" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppTopBar title="Suporte" variant="admin" />
      <main className="pt-14 pb-20 px-4">
        <Outlet />
      </main>
      <BottomNav items={navItems} />
    </div>
  );
}
