import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getStatusColor } from "@/lib/utils";
import { Play, Pause, Edit, Trash2, Filter, Plus, MessageSquare, ArrowRight, Bot } from "lucide-react";
import type { Pair } from "@shared/schema";

interface PairsTableProps {
  onAddPair: () => void;
}

// Helper function to render pair type flow
const renderPairTypeFlow = (pairType: string) => {
  if (pairType === 'tel-tel') {
    return (
      <div className="flex items-center space-x-1 text-xs">
        <MessageSquare className="w-3 h-3 text-blue-500" />
        <ArrowRight className="w-3 h-3 text-gray-400" />
        <MessageSquare className="w-3 h-3 text-blue-500" />
        <span className="ml-1 text-gray-600">Direct</span>
      </div>
    );
  } else if (pairType === 'tel-disc-tel') {
    return (
      <div className="flex items-center space-x-1 text-xs">
        <MessageSquare className="w-3 h-3 text-blue-500" />
        <ArrowRight className="w-3 h-3 text-gray-400" />
        <Bot className="w-3 h-3 text-purple-500" />
        <ArrowRight className="w-3 h-3 text-gray-400" />
        <MessageSquare className="w-3 h-3 text-blue-500" />
        <span className="ml-1 text-gray-600">Enhanced</span>
      </div>
    );
  }
  return <span className="text-xs text-gray-500">Unknown</span>;
};

export default function PairsTable({ onAddPair }: PairsTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pairs, isLoading } = useQuery<Pair[]>({
    queryKey: ["/api/pairs"],
  });

  const updatePairMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<Pair> }) =>
      apiRequest("PATCH", `/api/pairs/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pairs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update pair",
        variant: "destructive",
      });
    },
  });

  const deletePairMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/pairs/${id}`),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Pair deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/pairs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete pair",
        variant: "destructive",
      });
    },
  });

  const handleTogglePair = (pair: Pair) => {
    const newStatus = pair.status === "active" ? "paused" : "active";
    updatePairMutation.mutate({
      id: pair.id,
      updates: { status: newStatus },
    });
  };

  const handleDeletePair = (id: number) => {
    if (confirm("Are you sure you want to delete this pair?")) {
      deletePairMutation.mutate(id);
    }
  };

  const getPairIcon = (name: string) => {
    const initials = name.substring(0, 2).toUpperCase();
    const colors = ["bg-primary", "bg-accent", "bg-secondary", "bg-purple-600"];
    const colorIndex = name.length % colors.length;
    return { initials, color: colors[colorIndex] };
  };

  if (isLoading) {
    return (
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
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

  // Mobile Card Component
  const PairCard = ({ pair }: { pair: Pair }) => {
    const icon = getPairIcon(pair.name);
    return (
      <Card key={pair.id} className="p-4 space-y-3 hover:shadow-md transition-shadow duration-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 ${icon.color} text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0`}>
              {icon.initials}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-medium text-gray-900 truncate">{pair.name}</h4>
              <p className="text-xs text-gray-500">
                {pair.enableAI ? "AI Enabled" : "Basic Filter"}
              </p>
            </div>
          </div>
          <Badge className={getStatusColor(pair.status)}>
            {pair.status.charAt(0).toUpperCase() + pair.status.slice(1)}
          </Badge>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Type:</span>
            {renderPairTypeFlow(pair.pairType || 'tel-disc-tel')}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Source:</span>
            <span className="text-xs text-gray-900 truncate ml-2">{pair.sourceChannel}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Destination:</span>
            <span className="text-xs text-gray-900 truncate ml-2">{pair.destinationChannel}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Messages:</span>
            <span className="text-xs text-gray-900">{pair.messageCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Session:</span>
            <span className="text-xs text-gray-900">{pair.session}</span>
          </div>
        </div>
        
        <div className="flex justify-center space-x-2 pt-2 border-t border-gray-100">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleTogglePair(pair)}
            disabled={updatePairMutation.isPending}
            className={`flex-1 text-xs ${pair.status === "active" ? "text-primary" : "text-secondary"}`}
          >
            {pair.status === "active" ? (
              <><Pause className="w-3 h-3 mr-1" />Pause</>
            ) : (
              <><Play className="w-3 h-3 mr-1" />Start</>
            )}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex-1 text-xs text-gray-600"
            onClick={() => {
              toast({
                title: "Edit Feature",
                description: "Pair editing functionality coming soon",
              });
            }}
          >
            <Edit className="w-3 h-3 mr-1" />Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeletePair(pair.id)}
            disabled={deletePairMutation.isPending}
            className="flex-1 text-xs text-red-600 hover:text-red-900"
          >
            <Trash2 className="w-3 h-3 mr-1" />Delete
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <Card className="mb-6 md:mb-8">
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Active Pairs</h3>
          <div className="flex items-center space-x-2 md:space-x-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-gray-600 text-xs md:text-sm"
              onClick={() => {
                toast({
                  title: "Filter Options",
                  description: "Filtering options will be available soon",
                });
              }}
            >
              <Filter className="w-3 h-3 md:w-4 md:h-4 mr-1" />
              Filter
            </Button>
            <Button onClick={onAddPair} size="sm" className="bg-primary text-white hover:bg-blue-700 text-xs md:text-sm">
              <Plus className="w-3 h-3 md:w-4 md:h-4 mr-1" />
              Add Pair
            </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile Card Layout (visible on screens < 768px) */}
      <div className="md:hidden">
        {pairs && pairs.length > 0 ? (
          <div className="p-3 space-y-3">
            {pairs.map((pair) => (
              <PairCard key={pair.id} pair={pair} />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm">No pairs configured yet</p>
            <p className="text-xs text-gray-400 mt-1">Click "Add Pair" to get started</p>
          </div>
        )}
      </div>

      {/* Desktop Table Layout (visible on screens >= 768px) */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pair Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source Channel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Destination
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Messages
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Session
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pairs && pairs.length > 0 ? (
                pairs.map((pair) => {
                  const icon = getPairIcon(pair.name);
                  return (
                    <tr key={pair.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`w-8 h-8 ${icon.color} text-white rounded-full flex items-center justify-center text-sm font-bold`}>
                            {icon.initials}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{pair.name}</div>
                            <div className="text-sm text-gray-500">
                              {pair.enableAI ? "AI Enabled" : "Basic Filter"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderPairTypeFlow(pair.pairType || 'tel-disc-tel')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{pair.sourceChannel}</div>
                        <div className="text-sm text-gray-500">Telegram Private</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{pair.destinationChannel}</div>
                        <div className="text-sm text-gray-500">via Discord</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className={getStatusColor(pair.status)}>
                          {pair.status.charAt(0).toUpperCase() + pair.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {pair.messageCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{pair.session}</div>
                        <div className="text-sm text-gray-500">Healthy</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePair(pair)}
                          disabled={updatePairMutation.isPending}
                          className={pair.status === "active" ? "text-primary" : "text-secondary"}
                        >
                          {pair.status === "active" ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-gray-600"
                          onClick={() => {
                            toast({
                              title: "Edit Feature",
                              description: "Pair editing functionality coming soon",
                            });
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePair(pair.id)}
                          disabled={deletePairMutation.isPending}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-sm">No pairs configured yet</p>
                    <p className="text-xs text-gray-400 mt-1">Click "Add Pair" to get started</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
