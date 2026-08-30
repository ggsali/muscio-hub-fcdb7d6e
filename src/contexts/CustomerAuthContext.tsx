import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate, useLocation } from "@/lib/router-compat";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface CustomerAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | null>(null);

// Pfade, von denen NICHT auf /profil-vervollstaendigen umgeleitet werden soll
const SKIP_REDIRECT_PREFIXES = [
  "/admin",
  "/profil-vervollstaendigen",
  "/anmelden",
  "/registrieren",
  "/login",
  "/unsubscribe",
  "/bewertung",
  "/upload",
];

export const CustomerAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const checkProfileComplete = async (userId: string) => {
    // Skip wenn auf bestimmten Routen
    if (SKIP_REDIRECT_PREFIXES.some(p => location.pathname.startsWith(p))) return;

    // Admins überspringen
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", userId);
    if (roles?.some((r: any) => r.role === "admin")) return;

    const { data } = await supabase
      .from("profiles")
      .select("strasse, plz, ort, vorname, nachname")
      .eq("user_id", userId)
      .maybeSingle();

    const isComplete = data?.strasse && data?.plz && data?.ort && data?.vorname && data?.nachname;
    if (!isComplete) {
      navigate("/profil-vervollstaendigen");
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
        // Defer to avoid blocking auth callback
        setTimeout(() => { checkProfileComplete(session.user.id); }, 0);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      if (data.session?.user) {
        setTimeout(() => { checkProfileComplete(data.session!.user.id); }, 0);
      }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/anmelden`,
      },
    });
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <CustomerAuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </CustomerAuthContext.Provider>
  );
};

export const useCustomerAuth = () => {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) {
    return {
      user: null, session: null, loading: false,
      signUp: async () => ({ error: "Not initialized" }),
      signIn: async () => ({ error: "Not initialized" }),
      signOut: async () => {},
    };
  }
  return ctx;
};
