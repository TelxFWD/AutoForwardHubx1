import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import type { Blocklist } from "@shared/schema";

export default function BlocklistSummary() {
  const { data: blocklists, isLoading } = useQuery<Blocklist[]>({
    queryKey: ["/api/blocklists"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-6 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const wordCount = blocklists?.filter(b => b.type === "word" && b.isActive).length || 0;
  const imageCount = blocklists?.filter(b => b.type === "image_hash" && b.isActive).length || 0;
  const trapCount = blocklists?.filter(b => b.type === "trap_pattern" && b.isActive).length || 0;

  const lastUpdated = blocklists && blocklists.length > 0 
    ? new Date(Math.max(...blocklists.map(b => new Date(b.createdAt!).getTime())))
    : null;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Blocklist Summary</h3>
          <Button variant="ghost" size="sm" className="text-primary hover:text-blue-700">
            <Settings className="w-4 h-4 mr-1" />
            Manage
          </Button>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <i className="fas fa-font text-gray-400"></i>
              <span className="text-sm text-gray-600">Blocked Words</span>
            </div>
            <span className="text-sm font-medium text-gray-900">{wordCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <i className="fas fa-image text-gray-400"></i>
              <span className="text-sm text-gray-600">Image Hashes</span>
            </div>
            <span className="text-sm font-medium text-gray-900">{imageCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <i className="fas fa-exclamation-triangle text-gray-400"></i>
              <span className="text-sm text-gray-600">Trap Patterns</span>
            </div>
            <span className="text-sm font-medium text-gray-900">{trapCount}</span>
          </div>
          <div className="pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              Last updated: {lastUpdated ? lastUpdated.toLocaleDateString() : "Never"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
