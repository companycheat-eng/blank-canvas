import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Users, UserCheck, ChevronRight, Car, HeadphonesIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminCadastros() {
  const { userType } = useAuth();
  const isGeral = userType === "admin_geral";

  const items = [
    { to: "/admin/clientes", icon: UserCheck, label: "Clientes", desc: "Lista e edição de clientes cadastrados" },
    { to: "/admin/motoristas", icon: Users, label: "Motoristas", desc: "Lista e gestão de motoristas" },
    { to: "/admin/corridas", icon: Car, label: "Corridas", desc: "Corridas ativas e histórico" },
    ...(isGeral ? [{ to: "/admin/suporte", icon: HeadphonesIcon, label: "Suporte", desc: "Gerenciar agentes de suporte" }] : []),
  ];

  return (
    <div className="space-y-4 py-4">
      <h2 className="text-2xl font-bold">Cadastros</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <Link key={item.to} to={item.to}>
            <Card className="shadow-sm hover:bg-muted/50 transition-colors cursor-pointer">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
