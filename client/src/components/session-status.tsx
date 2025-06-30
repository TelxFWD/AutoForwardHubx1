import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import type { Session } from "@shared/schema";

export default function SessionStatus() {
  const { data: sessions, isLoading, refetch } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Session Status</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="text-primary hover:text-blue-700"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
        <div className="space-y-3">
          {sessions?.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-user-shield text-purple-600"></i>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{session.name}</div>
                  <div className="text-xs text-gray-500">{session.phone}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${session.status === "active" ? "bg-success" : "bg-gray-400"}`}></div>
                <span className={`text-sm font-medium ${session.status === "active" ? "text-success" : "text-gray-500"}`}>
                  {session.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          ))}
          {(!sessions || sessions.length === 0) && (
            <div className="text-center py-8 text-gray-500">
              <i className="fas fa-user-shield text-4xl mb-2"></i>
              <p>No sessions configured</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
