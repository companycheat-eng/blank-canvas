import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/auth/LoginPage";
import EsqueciSenhaPage from "./pages/auth/EsqueciSenhaPage";
import RedefinirSenhaPage from "./pages/auth/RedefinirSenhaPage";
import CadastroClientePage from "./pages/auth/CadastroClientePage";
import CadastroMotoristaPage from "./pages/auth/CadastroMotoristaPage";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminMotoristas from "./pages/admin/AdminMotoristas";
import AdminCorridas from "./pages/admin/AdminCorridas";
import AdminBairros from "./pages/admin/AdminBairros";
import AdminBairroDetalhe from "./pages/admin/AdminBairroDetalhe";
import AdminClientes from "./pages/admin/AdminClientes";
import AdminCadastros from "./pages/admin/AdminCadastros";
import AdminCatalogo from "./pages/admin/AdminCatalogo";
import AdminConfig from "./pages/admin/AdminConfig";
import AdminFaturamento from "./pages/admin/AdminFaturamento";
import AdminSuporte from "./pages/admin/AdminSuporte";
import AdminMigracao from "./pages/admin/AdminMigracao";
import SuporteLayout from "./pages/suporte/SuporteLayout";
import SuporteTickets from "./pages/suporte/SuporteTickets";
import SuporteChat from "./pages/suporte/SuporteChat";
import ClienteHome from "./pages/cliente/ClienteHome";
import ClienteMapa from "./pages/cliente/ClienteMapa";
import ClienteHistorico from "./pages/cliente/ClienteHistorico";
import ClientePerfil from "./pages/cliente/ClientePerfil";
import MotoristaHome from "./pages/motorista/MotoristaHome";
import MotoristaMapa from "./pages/motorista/MotoristaMapa";
import MotoristaHistorico from "./pages/motorista/MotoristaHistorico";
import MotoristaPerfil from "./pages/motorista/MotoristaPerfil";
import MotoristaCarteira from "./pages/motorista/MotoristaCarteira";
import PlaceholderPage from "./pages/PlaceholderPage";
import InstallPrompt from "./components/pwa/InstallPrompt";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
        <Toaster />
        <Sonner />
        <InstallPrompt />
        <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/esqueci-senha" element={<EsqueciSenhaPage />} />
            <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
            <Route path="/cadastro/cliente" element={<CadastroClientePage />} />
            <Route path="/cadastro/motorista" element={<CadastroMotoristaPage />} />

            {/* Admin */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="cadastros" element={<AdminCadastros />} />
              <Route path="motoristas" element={<AdminMotoristas />} />
              <Route path="corridas" element={<AdminCorridas />} />
              <Route path="bairros" element={<AdminBairros />} />
              <Route path="bairros/:bairroId" element={<AdminBairroDetalhe />} />
              <Route path="clientes" element={<AdminClientes />} />
              <Route path="catalogo" element={<AdminCatalogo />} />
              <Route path="config" element={<AdminConfig />} />
              <Route path="faturamento" element={<AdminFaturamento />} />
              <Route path="suporte" element={<AdminSuporte />} />
              <Route path="migracao" element={<AdminMigracao />} />
            </Route>

            {/* Suporte */}
            <Route path="/suporte" element={<SuporteLayout />}>
              <Route index element={<SuporteTickets />} />
              <Route path=":ticketId" element={<SuporteChat />} />
            </Route>

            {/* Cliente */}
            <Route path="/cliente" element={<ClienteHome />}>
              <Route index element={<ClienteMapa />} />
              <Route path="historico" element={<ClienteHistorico />} />
              <Route path="perfil" element={<ClientePerfil />} />
            </Route>

            {/* Motorista */}
            <Route path="/motorista" element={<MotoristaHome />}>
              <Route index element={<MotoristaMapa />} />
              <Route path="carteira" element={<MotoristaCarteira />} />
              <Route path="historico" element={<MotoristaHistorico />} />
              <Route path="perfil" element={<MotoristaPerfil />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
        </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
