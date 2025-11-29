import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Camera, User, PackageCheck, PackageX, LifeBuoy, Phone, Mail, QrCode, Video, HardDrive, FileArchive, KeyRound } from "lucide-react";
import logoUrl from "../../logo.png";
import { changeUserPassword } from "@/lib/utils";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface DashboardProps {
  onLogout?: () => void;
}

const Dashboard = ({ onLogout }: DashboardProps) => {
  const navigate = useNavigate();
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSnippet, setPwSnippet] = useState<string>("");
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

  const submitChangePassword = async () => {
    const email = user?.email;
    if (!email) return;
    if (!newPw || newPw !== confirmPw) return;
    const ok = await changeUserPassword(email, currentPw, newPw);
    if (ok) {
      setPwOpen(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      const username = user?.username ?? "";
      const displayName = user?.displayName ?? "";
      setPwSnippet(`{ username: "${username}", email: "${email}", password: "${newPw}", displayName: "${displayName}" },`);
      try {
        const r = await fetch("/api/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, username, displayName, oldPassword: currentPw, newPassword: newPw }),
        });
        if (r.ok) {
          toast.success("Server password updated");
        } else {
          toast.warning("Local Password Changed");
        }
      } catch {
        toast.warning("Server update failed");
      }
    }
  };

  return (
    <>
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
        <main className="container mx-auto px-8 py-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Account & Support (Combined) */}
          <div className="bg-[var(--glass-medium)] backdrop-blur-3xl border border-[var(--glass-border)] rounded-3xl p-8 shadow-[var(--shadow-glow)] hover:bg-[var(--glass-hover)] transition-all duration-300 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <User className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Account & Support</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="rounded-2xl bg-[var(--glass-light)] border border-[var(--glass-border)] p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><User className="w-3.5 h-3.5" /> <span>Name</span></div>
                <div className="text-sm text-foreground font-medium truncate">{user?.displayName ?? "—"}</div>
              </div>
              <div className="rounded-2xl bg-[var(--glass-light)] border border-[var(--glass-border)] p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Mail className="w-3.5 h-3.5" /> <span>Email</span></div>
                <div className="text-sm text-foreground font-medium truncate">{user?.email ?? "—"}</div>
              </div>
              <div className="rounded-2xl bg-[var(--glass-light)] border border-[var(--glass-border)] p-4 sm:col-span-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><User className="w-3.5 h-3.5" /> <span>Username</span></div>
                <div className="text-sm text-foreground font-medium truncate">{user?.username ?? "—"}</div>
              </div>
              <div className="sm:col-span-2">
                <Button variant="glass-white" className="w-full h-11 px-6 text-sm font-semibold" onClick={() => setPwOpen(true)}>
                  <KeyRound className="w-4 h-4 mr-2" /> Change Password
                </Button>
              </div>
              {pwSnippet && (
                <div className="sm:col-span-2 rounded-2xl bg-[var(--glass-light)] border border-[var(--glass-border)] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-muted-foreground">Code update snippet</div>
                    <Button variant="glass-white" className="h-8 px-3 text-xs" onClick={() => navigator.clipboard.writeText(pwSnippet)}>Copy</Button>
                  </div>
                  <pre className="text-xs text-foreground whitespace-pre-wrap break-words">{pwSnippet}</pre>
                  <div className="mt-2 text-xs text-muted-foreground">Paste this into <code>src/lib/utils.ts</code> inside <code>DEFAULT_USERS_PLAINTEXT</code>.</div>
                </div>
              )}
            </div>
            <div className="rounded-2xl bg-[var(--glass-light)] border border-[var(--glass-border)] p-6 mt-auto">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                  <LifeBuoy className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold">Technical Support</h3>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> <span className="text-foreground font-medium">+91 942-666-3000</span></p>
                <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> <span className="text-foreground font-medium">+1 (734)-288-8659</span></p>
                <p className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> <span className="text-foreground font-medium">support@shipsight.in</span></p>
              </div>
            </div>
          </div>

          {/* VMS Access */}
          <div className="bg-[var(--glass-medium)] backdrop-blur-3xl border border-[var(--glass-border)] rounded-3xl p-8 shadow-[var(--shadow-glow)] hover:bg-[var(--glass-hover)] transition-all duration-300 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <Camera className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Video Management System (VMS)</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Control camera, scan barcodes, and record high‑quality videos with folder organization and logs.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><QrCode className="w-4 h-4 text-primary" /><span>Barcode scanning</span></div>
              <div className="flex items-center gap-2"><Video className="w-4 h-4 text-primary" /><span>Full HD recording</span></div>
              <div className="flex items-center gap-2"><HardDrive className="w-4 h-4 text-primary" /><span>Forward/Reverse folders</span></div>
              <div className="flex items-center gap-2"><FileArchive className="w-4 h-4 text-primary" /><span>Reverse photos ZIP</span></div>
            </div>
            <div className="mt-auto">
              <Button variant="glass-white" className="w-full h-12 px-6 text-base font-semibold hover:bg-[var(--glass-hover)]" onClick={() => navigate("/vms")}>Open VMS</Button>
            </div>
          </div>


          {/* Quick Actions removed per request */}
        </main>
      </div>
    </div>

    <Dialog open={pwOpen} onOpenChange={setPwOpen}>
      <DialogContent className="bg-[var(--glass-medium)] backdrop-blur-2xl border border-[var(--glass-border)]">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <input
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            placeholder="Current password"
            className="w-full px-4 py-3 rounded-xl bg-[var(--glass-light)] border border-[var(--glass-border)]"
          />
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="New password"
            className="w-full px-4 py-3 rounded-xl bg-[var(--glass-light)] border border-[var(--glass-border)]"
          />
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Confirm new password"
            className="w-full px-4 py-3 rounded-xl bg-[var(--glass-light)] border border-[var(--glass-border)]"
          />
        </div>
        <DialogFooter>
          <Button variant="glass-white" onClick={submitChangePassword}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default Dashboard;