import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow, getSeverityIcon, getSeverityColor } from "@/lib/utils";
import type { Activity } from "@shared/schema";

export default function ActivityFeed() {
  const { data: activities, isLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
    refetchInterval: 30000, // Refresh every 30 seconds for live updates
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSeverityBg = (severity: string): string => {
    switch (severity.toLowerCase()) {
      case 'success':
        return 'bg-green-50';
      case 'warning':
        return 'bg-yellow-50';
      case 'error':
        return 'bg-red-50';
      case 'info':
      default:
        return 'bg-gray-50';
    }
  };

  return (
    <Card>
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Live Activity Feed</h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Live</span>
          </div>
        </div>
      </div>
      
      <CardContent className="p-6">
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {activities?.map((activity) => (
            <div
              key={activity.id}
              className={`flex items-start space-x-3 p-3 ${getSeverityBg(activity.severity)} rounded-lg`}
            >
              <div className={`w-8 h-8 ${activity.severity === 'success' ? 'bg-success' : activity.severity === 'warning' ? 'bg-warning' : activity.severity === 'error' ? 'bg-error' : 'bg-primary'} rounded-full flex items-center justify-center`}>
                <i className={`fas ${getSeverityIcon(activity.severity)} text-white text-xs`}></i>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(activity.createdAt!))}
                  </span>
                </div>
                {activity.details && (
                  <p className="text-xs text-gray-600">{activity.details}</p>
                )}
              </div>
            </div>
          ))}
          {(!activities || activities.length === 0) && (
            <div className="text-center py-8 text-gray-500">
              <i className="fas fa-clock text-4xl mb-2"></i>
              <p>No recent activity</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
