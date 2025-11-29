import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { Login } from "./pages/Login";
import Dashboard from "@/pages/Dashboard";
import Landing from "@/pages/Landing";

const queryClient = new QueryClient();

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing authentication on app load - automatically logout on reload
  useEffect(() => {
    // Always start logged out on page reload/refresh
    setIsAuthenticated(false);
    localStorage.removeItem("shipsight_auth");
    // Clear any existing session lock and stored user on reload to avoid stale locks
    const userRaw = localStorage.getItem("shipsight_user");
    if (userRaw) {
      try {
        const user = JSON.parse(userRaw);
        if (user?.email) {
          localStorage.removeItem(`shipsight_lock_${user.email}`);
        }
      } catch {}
      localStorage.removeItem("shipsight_user");
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (success: boolean) => {
    if (success) {
      setIsAuthenticated(true);
      localStorage.setItem("shipsight_auth", "true");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("shipsight_auth");
    // Remove session lock for current user
    const userRaw = localStorage.getItem("shipsight_user");
    if (userRaw) {
      try {
        const user = JSON.parse(userRaw);
        if (user?.email) {
          localStorage.removeItem(`shipsight_lock_${user.email}`);
        }
      } catch {}
      localStorage.removeItem("shipsight_user");
    }
  };

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading ShipSight...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {(() => {
            const SEOUpdater = () => {
              const location = useLocation();
              useEffect(() => {
                const isVms = typeof window !== "undefined" && window.location.hostname.startsWith("vms.");
                const title = isVms ? "ShipSight VMS | Video Management for E-commerce" : "ShipSight | E-commerce Video Management & Packing Recorder";
                const desc = isVms
                  ? "Secure video management system for e-commerce packing workflows. Record, search, and share barcode-linked videos."
                  : "E-commerce video management (VMS) for packing — barcode-linked recording.";
                const robots = isVms && location.pathname !== "/" ? "noindex,nofollow" : "index,follow";
                const setMeta = (selector: string, attr: string, value: string) => {
                  const el = document.querySelector(selector) as HTMLMetaElement | null;
                  if (el) el.setAttribute(attr, value);
                };
                document.title = title;
                setMeta('meta[name="description"]', "content", desc);
                setMeta('meta[name="robots"]', "content", robots);
                setMeta('meta[property="og:title"]', "content", title);
                setMeta('meta[property="og:description"]', "content", desc);
                setMeta('meta[property="og:url"]', "content", window.location.href);
                const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
                if (canonical) canonical.setAttribute("href", window.location.origin + location.pathname);
              }, [location.pathname]);
              return null;
            };
            return <SEOUpdater />;
          })()}
          {(() => {
            const isVms = typeof window !== "undefined" && window.location.hostname.startsWith("vms.");
            const homeEl = isVms ? (isAuthenticated ? <Index onLogout={handleLogout} /> : <Login onLogin={handleLogin} />) : <Landing />;
            const authRedirect = isVms ? "/" : "/vms";
            return (
              <Routes>
                <Route path="/" element={homeEl} />
                <Route path="/vms" element={isAuthenticated ? <Index onLogout={handleLogout} /> : <Login onLogin={handleLogin} />} />
                <Route path="/dashboard" element={isAuthenticated ? <Dashboard onLogout={handleLogout} /> : <Navigate to={authRedirect} replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            );
          })()}
        </BrowserRouter>
        <Analytics />
        <SpeedInsights />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
