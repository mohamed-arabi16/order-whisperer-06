import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useParams } from "react-router-dom";
import { POSDashboard } from "@/components/pos/POSDashboard";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/hooks/useTranslation";
import { toast } from "sonner";

/**
 * POS System page component that displays the POS system dashboard
 * Only accessible by authenticated restaurant owners and super admins
 */
const POSSystem = (): JSX.Element => {
  const { slug } = useParams();
  const { user, loading, isAdmin, isRestaurantOwner, tenantId } = useAuth();
  const { t } = useTranslation();
  const [tenant, setTenant] = useState<{ id: string; subscription_plan: string; } | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  useEffect(() => {
    const checkSubscription = async () => {
      if (process.env.NODE_ENV === 'development') {
        console.log("POSSystem: Checking subscription for slug:", slug);
      }
      
      if (!slug) {
        toast.error("No restaurant identifier provided in URL");
        setCheckingSubscription(false);
        return;
      }

      try {
        const { data: tenantData, error } = await supabase
          .from('tenants')
          .select('id, subscription_plan')
          .eq('slug', slug)
          .maybeSingle();

        if (error) {
          console.error("POSSystem: Error fetching tenant:", error);
          toast.error("Failed to verify restaurant access. Please try again.");
          throw error;
        }

        if (!tenantData) {
          toast.error("Restaurant not found. Please check the URL and try again.");
          setTenant(null);
          setCheckingSubscription(false);
          return;
        }

        if (process.env.NODE_ENV === 'development') {
          console.log("POSSystem: Found tenant:", tenantData);
        }
        setTenant(tenantData);
      } catch (error) {
        console.error('POSSystem: Error checking subscription:', error);
        toast.error("Unable to access POS system. Please contact support if this continues.");
      } finally {
        setCheckingSubscription(false);
      }
    };

    checkSubscription();
  }, [slug]);

  // Add loading timeout to prevent infinite loading - fire only once on mount
  useEffect(() => {
    const timer = setTimeout(() => setLoadingTimeout(true), 10000);
    return () => clearTimeout(timer);
  }, []);

  // Debug logging - only in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log("POSSystem: Auth state - loading:", loading, "user:", !!user, "tenantId:", tenantId, "isAdmin:", isAdmin);
      console.log("POSSystem: Subscription state - checking:", checkingSubscription, "tenant:", tenant);
    }
  }, [loading, user, tenantId, isAdmin, checkingSubscription, tenant]);

  if ((loading || checkingSubscription) && !loadingTimeout) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t("common.loading")}</p>
          <p className="text-xs text-muted-foreground mt-2">Checking authentication and subscription...</p>
        </div>
      </div>
    );
  }

  if (loadingTimeout) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-destructive text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">Loading Timeout</h2>
          <p className="text-muted-foreground mb-4">The system is taking longer than expected to load.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin && tenant) {
    if (tenant.subscription_plan !== 'premium') {
      toast.error("Premium subscription required to access POS system");
      return <Navigate to={`/pos-access/${slug}`} replace />;
    }
    // Only allow restaurant owners to access their own premium tenant
    if (isRestaurantOwner && tenantId && tenant.id !== tenantId) {
      toast.error("You are not authorized to access this restaurant's POS system");
      return <Navigate to={`/dashboard`} replace />;
    }
  }

  // Handle case where tenant lookup failed but no error was thrown
  if (!tenant && !checkingSubscription && slug) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-destructive text-6xl mb-4">🚫</div>
          <h2 className="text-xl font-bold mb-2">Restaurant Not Found</h2>
          <p className="text-muted-foreground mb-4">The restaurant "{slug}" could not be found or is not accessible.</p>
          <div className="flex gap-2 justify-center">
            <button 
              onClick={() => window.location.reload()} 
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
            <button 
              onClick={() => window.history.back()} 
              className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <POSDashboard />
    </div>
  );
};

export default POSSystem;