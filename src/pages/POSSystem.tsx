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
      if (!slug) {
        toast.error(t("pos.errors.noSlug"));
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
          toast.error(t("pos.errors.tenantFetchFailed"));
          throw error;
        }

        if (!tenantData) {
          toast.error(t("pos.errors.tenantNotFound"));
          setTenant(null);
          setCheckingSubscription(false);
          return;
        }

        setTenant(tenantData);
      } catch (error) {
        console.error('POSSystem: Error checking subscription:', error);
        toast.error(t("pos.errors.posAccessFailed"));
      } finally {
        setCheckingSubscription(false);
      }
    };

    checkSubscription();
  }, [slug, t]);

  // Add loading timeout to prevent infinite loading - fire only once on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadingTimeout(true);
      if (loading || checkingSubscription) {
        toast.error(t("pos.errors.loadingTimeout"));
      }
    }, 8000); // Reduced to 8 seconds for better UX
    return () => clearTimeout(timer);
  }, []);

  // Simplified loading state - timeout triggers regardless of auth state
  const isStillLoading = (loading || checkingSubscription) && !loadingTimeout;
  const shouldShowTimeout = loadingTimeout && (loading || checkingSubscription);

  // Only show loading if we're actually loading and haven't timed out
  if (isStillLoading) {
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

  if (shouldShowTimeout) {
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
      toast.error(t("pos.errors.premiumRequired"));
      return <Navigate to={`/pos-access/${slug}`} replace />;
    }
    // Only allow restaurant owners to access their own premium tenant
    if (isRestaurantOwner && tenantId && tenant.id !== tenantId) {
      toast.error(t("pos.errors.unauthorized"));
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