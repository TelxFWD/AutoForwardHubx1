import { useState, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/error-boundary";
import Sidebar from "@/components/sidebar";
import Dashboard from "@/pages/dashboard";
import TelXPage from "@/pages/telx";
import { LoginPage } from "@/pages/LoginPage";
import { AdminPage } from "@/pages/AdminPage";

function App() {
  const [activeView, setActiveView] = useState("dashboard");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [location] = useLocation();

  useEffect(() => {
    // Check for authentication token on app load
    const token = localStorage.getItem("authToken");
    const userData = localStorage.getItem("userData");
    
    if (token && userData) {
      setIsAuthenticated(true);
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogin = (userData: any, token: string) => {
    setIsAuthenticated(true);
    setUser(userData);
    localStorage.setItem("authToken", token);
    localStorage.setItem("userData", JSON.stringify(userData));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem("authToken");
    localStorage.removeItem("userData");
  };

  const renderContent = () => {
    switch (activeView) {
      case "telx":
        return <TelXPage />;
      case "dashboard":
      case "pairs":
      case "sessions":
      case "blocklist":
      case "monitoring":
      case "webhooks":
      case "settings":
        return <Dashboard activeTab={activeView} />;
      default:
        return <Dashboard activeTab="dashboard" />;
    }
  };

  // Admin route - always accessible
  if (location === "/adminx") {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ErrorBoundary>
            <AdminPage />
          </ErrorBoundary>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // Login screen for unauthenticated users
  if (!isAuthenticated) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ErrorBoundary>
            <LoginPage onLogin={handleLogin} />
          </ErrorBoundary>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // Main dashboard for authenticated users
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <div className="flex h-screen bg-gray-50">
            <ErrorBoundary>
              <Sidebar 
                activeView={activeView} 
                onViewChange={setActiveView}
                user={user}
                onLogout={handleLogout}
              />
            </ErrorBoundary>
            <main className="flex-1 overflow-y-auto">
              <div className="p-6">
                <ErrorBoundary>
                  {renderContent()}
                </ErrorBoundary>
              </div>
            </main>
          </div>
        </ErrorBoundary>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
