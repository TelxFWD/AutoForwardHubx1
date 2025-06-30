import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Link, 
  Shield, 
  Ban, 
  Activity, 
  Webhook, 
  Settings,
  MessageSquare
} from "lucide-react";

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export default function Sidebar({ activeView, onViewChange }: SidebarProps) {
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

  return (
    <div className="w-64 bg-white dark:bg-gray-900 shadow-lg flex-shrink-0 border-r">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary text-white rounded-lg flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">AutoForwardX</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Admin Dashboard</p>
          </div>
        </div>
      </div>
      
      <nav className="mt-6 px-4">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onViewChange(item.id)}
                  className={cn(
                    "w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors duration-200",
                    activeView === item.id
                      ? "bg-primary text-white"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
