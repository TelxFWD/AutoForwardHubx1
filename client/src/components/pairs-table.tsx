import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getStatusColor } from "@/lib/utils";
import { Play, Pause, Edit, Trash2, Filter, Plus } from "lucide-react";
import type { Pair } from "@shared/schema";

interface PairsTableProps {
  onAddPair: () => void;
}

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

  return (
    <Card className="mb-8">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Active Pairs</h3>
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-gray-600"
              onClick={() => {
                toast({
                  title: "Filter Options",
                  description: "Filtering options will be available soon",
                });
              }}
            >
              <Filter className="w-4 h-4 mr-1" />
              Filter
            </Button>
            <Button onClick={onAddPair} size="sm" className="bg-primary text-white hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-1" />
              Add Pair
            </Button>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pair Name
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
            {pairs?.map((pair) => {
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
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
