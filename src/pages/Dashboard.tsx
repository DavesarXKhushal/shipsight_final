import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Camera, User, PackageCheck, PackageX } from "lucide-react";
import logoUrl from "../../logo.png";

interface DashboardProps {
  onLogout?: () => void;
}

const Dashboard = ({ onLogout }: DashboardProps) => {
  const navigate = useNavigate();
  const user = useMemo(() => {
    try {
      const raw = localStorage.getItem("shipsight_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const handleLogoutClick = () => {
    onLogout?.();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-foreground overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0f1e] via-[#0d1117] to-[#050810]" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-[var(--glass-border)] bg-[var(--glass-light)] backdrop-blur-2xl sticky top-0 z-50">
          <div className="container mx-auto px-8 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--glass-medium)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-[var(--shadow-lg)] flex items-center justify-center">
                  <img src={logoUrl} alt="ShipSight Logo" className="w-8 h-8 object-contain" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    ShipSight
                  </h1>
                  <p className="text-xs text-muted-foreground font-medium">
                    Main Dashboard
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="glass-white" onClick={handleLogoutClick} className="h-11 px-6">
                  <LogOut className="w-4 h-4 mr-2" /> Logout
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="container mx-auto px-8 py-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="bg-[var(--glass-medium)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl p-8 shadow-[var(--shadow-lg)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <User className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Profile</h2>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p><span className="text-foreground font-medium">Name:</span> {user?.displayName ?? "—"}</p>
              <p><span className="text-foreground font-medium">Email:</span> {user?.email ?? "—"}</p>
              <p><span className="text-foreground font-medium">Username:</span> {user?.username ?? "—"}</p>
            </div>
            <div className="mt-6">
              <Button variant="glass-white" className="h-9 px-4 text-sm font-medium">Edit Credentials</Button>
            </div>
          </div>

          {/* VMS Access */}
          <div className="bg-[var(--glass-medium)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl p-8 shadow-[var(--shadow-lg)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <Camera className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Video Management System (VMS)</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">Access camera, barcode scanning, and recording controls.</p>
            <Button variant="glass-white" className="w-full h-12 px-6 text-base font-semibold" onClick={() => navigate("/vms")}>Go to VMS</Button>
          </div>

          {/* Package Flow */}
          <div className="bg-[var(--glass-medium)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl p-8 shadow-[var(--shadow-lg)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <PackageCheck className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Package Direction</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">Choose shipment flow before proceeding to VMS.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button variant="glass-white" className="h-12 px-6 text-base font-semibold">Forward Shipment</Button>
              <Button variant="glass-white" className="h-12 px-6 text-base font-semibold">Return Shipment</Button>
            </div>
          </div>

          {/* Quick Actions removed per request */}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;