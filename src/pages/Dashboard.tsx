import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate } from "react-router-dom";
import SuperAdminDashboard from "@/components/admin/SuperAdminDashboard";
import RestaurantDashboard from "@/components/restaurant/RestaurantDashboard";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { isValidRole } from "@/lib/constants";

/**
 * A page component that acts as a router for the dashboard.
 * It displays the appropriate dashboard based on the user's role.
 *
 * @returns {JSX.Element} The rendered dashboard page.
 */
const Dashboard = (): JSX.Element => {
  const { user, profile, loading, isAdmin, isRestaurantOwner, signOut } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (isAdmin) {
    return <SuperAdminDashboard />;
  }

  if (isRestaurantOwner) {
    return <RestaurantDashboard />;
  }

  // Unknown or invalid role - show helpful error
  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-lg p-6 text-center space-y-4">
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{t("dashboard.roleError.title")}</h1>
          <p className="text-muted-foreground">
            {t("dashboard.roleError.description")}
          </p>
          {profile?.role && !isValidRole(profile.role) && (
            <p className="text-sm text-muted-foreground mt-2">
              {t("dashboard.roleError.invalidRole")}: <code className="bg-muted px-2 py-1 rounded">{profile.role}</code>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-4">
          <Button onClick={handleSignOut} variant="outline">
            {t("dashboard.roleError.signOut")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t("dashboard.roleError.contactSupport")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;