import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { USER_ROLES } from "@/lib/constants";

/**
 * @interface AuthContextType
 * @property {User | null} user - The authenticated user object, or null if not authenticated.
 * @property {Session | null} session - The current session object, or null if there is no session.
 * @property {any} profile - The user's profile data from the database.
 * @property {string | null} tenantId - The ID of the tenant associated with the user.
 * @property {boolean} loading - True if the authentication state is currently being loaded.
 * @property {(email: string, password: string, fullName: string, role?: string) => Promise<{ error: any }>} signUp - Function to sign up a new user.
 * @property {(email: string, password: string) => Promise<{ error: any }>} signIn - Function to sign in a user.
 * @property {() => Promise<{ error: any }>} signOut - Function to sign out the current user.
 * @property {boolean} isAdmin - True if the current user has the 'super_admin' role.
 * @property {boolean} isRestaurantOwner - True if the current user has the 'restaurant_owner' role.
 */
interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any;
  tenantId: string | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role?: string
  ) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  isAdmin: boolean;
  isRestaurantOwner: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * A component that provides authentication context to its children.
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The child components.
 * @returns {JSX.Element} The rendered authentication provider.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Test-specific mock logic
    if (import.meta.env.MODE === 'test' && window.localStorage.getItem('mock-auth-state')) {
      const mockState = JSON.parse(window.localStorage.getItem('mock-auth-state') || '{}');
      setUser(mockState.user);
      setProfile(mockState.profile);
      setTenantId(mockState.tenantId);
      setLoading(mockState.loading);
      return;
    }

    let mounted = true;
    console.log(`[${new Date().toISOString()}] [useAuth] AuthProvider mounted.`);

    // Set a global timeout to ensure loading never hangs indefinitely
    const globalTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn(`[${new Date().toISOString()}] [useAuth] Global timeout (8s). Forcing loading to false.`);
        setLoading(false);
      }
    }, 8000);
    
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log(`[${new Date().toISOString()}] [useAuth] Auth event: ${_event}`);
      
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      // Clear state if no session
      if (!session?.user) {
        if (mounted) {
          console.log(`[${new Date().toISOString()}] [useAuth] No session, clearing state.`);
          setProfile(null);
          setTenantId(null);
          setLoading(false);
        }
        return;
      }

      // Fetch profile - simplified without complex timeout wrapper
      console.log(`[${new Date().toISOString()}] [useAuth] Fetching profile for user ${session.user.id}`);
      try {
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", session.user.id)
          .single();

        if (!mounted) return;

        if (error) {
          console.error("useAuth: Profile fetch error:", error);
          setProfile(null);
          setLoading(false);
          return;
        }

        console.log(`[${new Date().toISOString()}] [useAuth] Profile loaded:`, profileData);
        setProfile(profileData);
        
        // Resolve tenant asynchronously (non-blocking)
        if (profileData.role === USER_ROLES.RESTAURANT_OWNER) {
          console.log(`[${new Date().toISOString()}] [useAuth] Looking up tenant for restaurant owner`);
          // Don't block on tenant lookup - do it async
          (async () => {
            try {
              const { data } = await supabase
                .from("tenants")
                .select("id")
                .eq("owner_id", profileData.id)
                .maybeSingle();
              
              if (mounted && data) {
                setTenantId(data.id);
              }
            } catch (err) {
              console.error("useAuth: Tenant lookup error:", err);
            }
          })();
        }
        
        // Set loading to false immediately after profile is loaded
        setLoading(false);
        
      } catch (err) {
        if (mounted) {
          console.error("useAuth: Profile fetch exception:", err);
          setProfile(null);
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      console.log(`[${new Date().toISOString()}] [useAuth] Cleanup.`);
      clearTimeout(globalTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // Tenant resolution is now handled inline in the auth state change handler above
  // This prevents the complex second useEffect that was causing issues

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role = "restaurant_owner"
  ) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          role: role,
        },
      },
    });

    if (error) {
      toast.error(
        error.message === "User already registered"
          ? "المستخدم مسجل بالفعل"
          : "حدث خطأ أثناء التسجيل"
      );
    } else {
      toast.success("تم التسجيل بنجاح - تحقق من بريدك الإلكتروني لتأكيد الحساب");
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "بيانات الدخول غير صحيحة"
          : "حدث خطأ أثناء تسجيل الدخول"
      );
    }

    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("حدث خطأ أثناء تسجيل الخروج");
    }
    return { error };
  };

  const isAdmin = profile?.role === USER_ROLES.SUPER_ADMIN;
  const isRestaurantOwner = profile?.role === USER_ROLES.RESTAURANT_OWNER;

  const value = {
    user,
    session,
    profile,
    tenantId,
    loading,
    signUp,
    signIn,
    signOut,
    isAdmin,
    isRestaurantOwner,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * A custom hook for accessing the authentication context.
 * @returns {AuthContextType} The authentication context.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}