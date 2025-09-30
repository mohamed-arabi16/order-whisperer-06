import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRequestDeduplication } from "@/hooks/useRequestDeduplication";
import { withTimeout } from "@/utils/promise";

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
  const { executeRequest } = useRequestDeduplication();

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
    console.log(`[${new Date().toISOString()}] [useAuth] AuthProvider mounted. Setting up onAuthStateChange listener.`);

    const globalTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn(`[${new Date().toISOString()}] [useAuth] Global loading timeout reached (10s). Forcing loading to false.`);
        setLoading(false);
      }
    }, 10000);
    
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log(`[${new Date().toISOString()}] [useAuth] onAuthStateChange event triggered.`, { event: _event, session });
      if (!mounted) {
        console.log(`[${new Date().toISOString()}] [useAuth] Component unmounted, ignoring auth state change.`);
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      console.log(`[${new Date().toISOString()}] [useAuth] Session and user state updated.`, { userId: session?.user?.id });
      
      // Clear profile and set loading to false if no session
      if (!session?.user) {
        if (mounted) {
          console.log(`[${new Date().toISOString()}] [useAuth] No user session found. Clearing profile and stopping loading.`);
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      // Fetch profile data
      console.log(`[${new Date().toISOString()}] [useAuth] User session found. Fetching profile...`);
      try {
        const profilePromise = supabase
          .from("profiles")
          .select("*")
          .eq("user_id", session.user.id)
          .single();

        const { data: profileData, error } = await withTimeout(profilePromise, 3000, new Error('Profile fetch timed out'));

        if (!mounted) {
          console.log(`[${new Date().toISOString()}] [useAuth] Component unmounted, ignoring profile fetch result.`);
          return;
        }

        if (error) {
          console.error("useAuth: Error fetching profile:", error);
          setProfile(null);
        } else {
          console.log(`[${new Date().toISOString()}] [useAuth] Profile fetched successfully.`, { profile: profileData });
          setProfile(profileData);
        }
      } catch (err) {
        if (mounted) {
          console.error("useAuth: Profile fetch failed:", err);
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false); // Always set loading to false after profile resolution
          console.log(`[${new Date().toISOString()}] [useAuth] Profile resolution finished. Loading state set to false.`);
        }
      }
    });

    // The getSession() call is removed to rely solely on onAuthStateChange,
    // which is now triggered upon initial load. This simplifies the logic
    // and prevents race conditions.

    return () => {
      mounted = false;
      console.log(`[${new Date().toISOString()}] [useAuth] AuthProvider unmounted. Unsubscribing from onAuthStateChange.`);
      clearTimeout(globalTimeout);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const resolveTenant = async () => {
      console.log(`[${new Date().toISOString()}] [useAuth] Attempting to resolve tenant...`, { profile });
      if (!mounted || !profile) {
        if (profile === null) console.log(`[${new Date().toISOString()}] [useAuth] No profile, clearing tenantId.`);
        setTenantId(null);
        return;
      }

      try {
        // 1. Staff members have tenant_id directly on their profile.
        if (profile.tenant_id) {
          console.log(`[${new Date().toISOString()}] [useAuth] Resolved tenant from profile.tenant_id (staff member).`, { tenantId: profile.tenant_id });
          if (mounted) setTenantId(profile.tenant_id);
          return;
        }

        // 2. Restaurant owners need their tenant looked up.
        if (profile.role === "restaurant_owner") {
          console.log(`[${new Date().toISOString()}] [useAuth] Profile is restaurant_owner. Looking up tenant...`);

          const tenantLookupPromise = executeRequest(
            `tenant-lookup-${profile.id}`,
            async () => {
              const { data, error } = await supabase
                .from("tenants")
                .select("id")
                .eq("owner_id", profile.id)
                .maybeSingle();

              if (error) {
                console.error("useAuth: Tenant lookup failed inside executeRequest:", error);
                throw error;
              }
              return data;
            }
          );

          const tenant = await withTimeout(tenantLookupPromise, 3000, new Error('Tenant lookup timed out'));

          console.log(`[${new Date().toISOString()}] [useAuth] Tenant lookup complete.`, { tenantId: tenant?.id });
          if (mounted) setTenantId(tenant?.id || null);
          return;
        }

        // 3. Super admins and other roles do not have a tenant.
        console.log(`[${new Date().toISOString()}] [useAuth] Profile is not staff or owner (e.g., super_admin). No tenant to resolve.`);
        if (mounted) setTenantId(null);
      } catch (err) {
        console.error("useAuth: Failed to resolve tenant:", err);
        if (mounted) setTenantId(null);
      }
    };

    resolveTenant();

    return () => {
      mounted = false;
    };
  }, [profile, executeRequest]);

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

  const isAdmin = profile?.role === "super_admin";
  const isRestaurantOwner = profile?.role === "restaurant_owner";

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