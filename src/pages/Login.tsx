import { useState } from "react";
import { Eye, EyeOff, Ship, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import logoUrl from "../../logo.png";
import { verifyUserPassword } from "@/lib/utils";

interface LoginProps {
  onLogin: (success: boolean) => void;
}

export const Login = ({ onLogin }: LoginProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  

  

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 600));

    const result = await verifyUserPassword(email, password);
    if (result.ok && result.user) {
      // Enforce single-device login (local session lock)
      const lockKey = `shipsight_lock_${result.user.email}`;
      const existingLock = localStorage.getItem(lockKey);
      if (existingLock) {
        toast.error("This account is already logged in on another device.");
        onLogin(false);
        setIsLoading(false);
        return;
      }

      // Create session lock and store current user metadata
      const sessionId = (crypto as any)?.randomUUID ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random()}`;
      localStorage.setItem(lockKey, JSON.stringify({ sessionId, startedAt: Date.now() }));
      localStorage.setItem("shipsight_user", JSON.stringify({ email: result.user.email, username: result.user.username, displayName: result.user.displayName }));

      toast.success(`Welcome to ShipSight, ${result.user.displayName || result.user.username || result.user.email}!`);
      onLogin(true);
    } else {
      toast.error("Invalid credentials. Please try again.");
      onLogin(false);
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 flex flex-col">
      {/* Navbar */}
      <nav className="w-full px-6 py-4 border-b border-[var(--glass-border)] bg-[var(--glass-light)] backdrop-blur-xl">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--glass-medium)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-[var(--shadow-lg)] flex items-center justify-center">
              <img src={logoUrl} alt="ShipSight" className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                ShipSight
              </h1>
              <p className="text-xs text-muted-foreground -mt-1">One Platform for All Shipments</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Ship className="w-4 h-4" />
            <span>Shipment Management Platform</span>
          </div>
        </div>
      </nav>

      {/* Login Content */}
      <main className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <div className="bg-[var(--glass-medium)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-3xl p-8 shadow-[var(--shadow-glow)] hover:shadow-[var(--shadow-glow)] transition-all duration-500">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--glass-medium)] backdrop-blur-2xl border border-[var(--glass-border)] shadow-[var(--shadow-lg)] flex items-center justify-center">
                <img src={logoUrl} alt="ShipSight" className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">Welcome Back</h2>
              <p className="text-muted-foreground text-sm">Sign in to access your ShipSight dashboard</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-6">
              {/* Email/Username Field */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email Address or Username
                </label>
                <input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--glass-light)] border border-[var(--glass-border)] text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200"
                  placeholder="Enter your email or username"
                  required
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-[var(--glass-light)] border border-[var(--glass-border)] text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              

              {/* Action Buttons */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[var(--glass-medium)] backdrop-blur-2xl border border-[var(--glass-border)] hover:bg-[var(--glass-light)] text-foreground font-semibold rounded-xl shadow-[var(--shadow-lg)] hover:shadow-[var(--shadow-glow)] transition-all duration-300 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
              
            </form>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-[var(--glass-border)] text-center">
              <p className="text-xs text-muted-foreground">
                Secure shipment logistics platform
              </p>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              © 2025 ShipSight. Advanced shipment intelligence and logistics management.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};