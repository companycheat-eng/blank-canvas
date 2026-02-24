import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type UserType = "cliente" | "motorista" | "admin_geral" | "admin_bairro" | "suporte" | null;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userType: UserType;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  userType: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<UserType>(null);
  const [loading, setLoading] = useState(true);

  const detectUserType = async (userId: string, accessToken?: string): Promise<UserType> => {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const token = accessToken || apikey;
    const headers = {
      apikey,
      Authorization: `Bearer ${token}`,
    };

    try {
      const [rolesRes, motRes, cliRes] = await Promise.all([
        fetch(`${baseUrl}/rest/v1/user_roles?select=role&user_id=eq.${userId}&limit=1`, { headers }),
        fetch(`${baseUrl}/rest/v1/motoristas?select=id&user_id=eq.${userId}&limit=1`, { headers }),
        fetch(`${baseUrl}/rest/v1/clientes?select=id&user_id=eq.${userId}&limit=1`, { headers }),
      ]);

      const [roles, motoristas, clientes] = await Promise.all([
        rolesRes.json(),
        motRes.json(),
        cliRes.json(),
      ]);

      if (roles && roles.length > 0) {
        const role = roles[0].role as string;
        if (role === "admin_geral") return "admin_geral";
        if (role === "admin_bairro") return "admin_bairro";
        if (role === "suporte") return "suporte";
      }
      if (motoristas && motoristas.length > 0) return "motorista";
      if (clientes && clientes.length > 0) return "cliente";
    } catch (err) {
      console.error("Erro ao detectar tipo de usuário:", err);
    }

    return null;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Set loading true so Index waits for userType detection
          setLoading(true);
          const type = await detectUserType(session.user.id, session.access_token);
          setUserType(type);
        } else {
          setUserType(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const type = await detectUserType(session.user.id, session.access_token);
        setUserType(type);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      // Use fetch directly to avoid client hanging
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const token = session?.access_token || apikey;

      await fetch(`${baseUrl}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey,
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
    }

    // Clear local state regardless
    setSession(null);
    setUser(null);
    setUserType(null);
    localStorage.removeItem("sb-xivglpmjbwzlojlafxjh-auth-token");
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ session, user, userType, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
