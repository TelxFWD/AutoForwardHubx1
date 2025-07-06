import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import type { SystemStats } from "@shared/schema";

export default function StatsCards() {
  const { data: stats, isLoading } = useQuery<SystemStats>({
    queryKey: ["/api/stats"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4 md:p-6">
              <div className="h-20 md:h-24 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: "Active Pairs",
      value: stats?.activePairs || 0,
      subtitle: `${stats ? Math.max(0, 15 - stats.activePairs) : 0} paused`,
      icon: "fas fa-link",
      iconBg: "bg-blue-100",
      iconColor: "text-primary",
    },
    {
      title: "Messages Today",
      value: stats?.totalMessages || 0,
      subtitle: "+12% from yesterday",
      icon: "fas fa-paper-plane",
      iconBg: "bg-green-100",
      iconColor: "text-secondary",
      trend: "up",
    },
    {
      title: "Blocked Messages",
      value: stats?.blockedMessages || 0,
      subtitle: "5 trap detections",
      icon: "fas fa-shield-alt",
      iconBg: "bg-red-100",
      iconColor: "text-error",
    },
    {
      title: "Active Sessions",
      value: stats?.activeSessions || 0,
      subtitle: "All healthy",
      icon: "fas fa-user-shield",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
      {statCards.map((card, index) => (
        <Card key={index} className="bg-white rounded-lg md:rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 truncate">{card.title}</p>
                <p className="text-xl md:text-3xl font-bold text-gray-900 mt-1">{formatNumber(card.value)}</p>
              </div>
              <div className={`w-10 h-10 md:w-12 md:h-12 ${card.iconBg} rounded-lg flex items-center justify-center flex-shrink-0 ml-3`}>
                <i className={`${card.icon} ${card.iconColor} text-lg md:text-xl`}></i>
              </div>
            </div>
            <div className="mt-3 md:mt-4 flex items-center space-x-2">
              {card.trend === "up" ? (
                <i className="fas fa-arrow-up text-green-600 text-xs md:text-sm"></i>
              ) : (
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-600 rounded-full"></div>
              )}
              <span className={`text-xs md:text-sm truncate ${card.trend === "up" ? "text-green-600" : "text-gray-600"}`}>
                {card.subtitle}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
