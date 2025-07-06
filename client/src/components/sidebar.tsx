import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Link, 
  Shield, 
  Ban, 
  Activity, 
  Webhook, 
  Settings,
  MessageSquare,
  LogOut,
  User,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  user?: any;
  onLogout?: () => void;
}

export default function Sidebar({ activeView, onViewChange, user, onLogout }: SidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const navigationItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "telx", label: "TelX", icon: MessageSquare },
    { id: "pairs", label: "Pair Management", icon: Link },
    { id: "sessions", label: "Session Control", icon: Shield },
    { id: "blocklist", label: "Blocklist Manager", icon: Ban },
    { id: "monitoring", label: "Live Monitoring", icon: Activity },
    { id: "webhooks", label: "Discord Webhooks", icon: Webhook },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavigation = (view: string) => {
    onViewChange(view);
    setIsMobileMenuOpen(false);
  };

  const SidebarContent = () => (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-primary text-white rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">AutoForwardX</h1>
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Admin Dashboard</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 mt-4 md:mt-6 px-3 md:px-4">
        <ul className="space-y-1 md:space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => handleNavigation(item.id)}
                  className={cn(
                    "w-full flex items-center px-3 md:px-4 py-2 md:py-3 text-left rounded-lg transition-colors duration-200 text-sm md:text-base",
                    activeView === item.id
                      ? "bg-primary text-white"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  <Icon className="w-4 h-4 md:w-5 md:h-5 mr-2 md:mr-3 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      
      {/* User Profile & Logout */}
      {user && onLogout && (
        <div className="mt-auto p-3 md:p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 md:space-x-3 mb-2 md:mb-3">
            <div className="w-6 h-6 md:w-8 md:h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-3 h-3 md:w-4 md:h-4 text-gray-600 dark:text-gray-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-white truncate">
                {user.displayName || `User ${user.pin}`}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                PIN: {user.pin}
              </p>
            </div>
          </div>
          <Button
            onClick={onLogout}
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs md:text-sm"
          >
            <LogOut className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
            Logout
          </Button>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <>
        {/* Mobile Header with Hamburger Menu */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary text-white rounded-lg flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">AutoForwardX</h1>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Sidebar Sheet */}
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <div className="hidden md:flex w-64 bg-white dark:bg-gray-900 shadow-lg flex-shrink-0 border-r">
      <SidebarContent />
    </div>
  );
}
