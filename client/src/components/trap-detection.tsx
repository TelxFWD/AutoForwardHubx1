import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Shield, Plus, X, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Blocklist, Pair } from "@shared/schema";

export default function TrapDetection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newBlockText, setNewBlockText] = useState("");
  const [selectedPair, setSelectedPair] = useState<string>("global");

  const { data: blocklists = [], isLoading: blocklistsLoading } = useQuery({
    queryKey: ["/api/blocklists"],
    refetchInterval: 30000,
  });

  const { data: pairs = [] } = useQuery({
    queryKey: ["/api/pairs"],
  });

  const addBlocklistMutation = useMutation({
    mutationFn: (data: { type: string; value: string; pairId?: number }) =>
      apiRequest("POST", "/api/blocklists", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blocklists"] });
      setNewBlockText("");
      toast({
        title: "Block rule added",
        description: "New blocking rule has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add blocking rule.",
        variant: "destructive",
      });
    },
  });

  const deleteBlocklistMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/blocklists/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blocklists"] });
      toast({
        title: "Block rule removed",
        description: "Blocking rule has been removed successfully.",
      });
    },
  });

  const handleAddBlock = () => {
    if (!newBlockText.trim()) {
      toast({
        title: "Invalid input",
        description: "Please enter text to block.",
        variant: "destructive",
      });
      return;
    }

    const pairId = selectedPair === "global" ? undefined : parseInt(selectedPair);
    addBlocklistMutation.mutate({
      type: "text",
      value: newBlockText.trim(),
      pairId,
    });
  };

  const globalBlocks = blocklists.filter((b: Blocklist) => !b.pairId);
  const pairBlocks = blocklists.filter((b: Blocklist) => b.pairId);

  const trapPatterns = [
    { pattern: "/ *", description: "Forward slash with space trap" },
    { pattern: "1", description: "Single digit trap" },
    { pattern: "trap", description: "Explicit trap keyword" },
    { pattern: "leak", description: "Leak warning" },
    { pattern: "copy warning", description: "Copy warning message" },
  ];

  if (blocklistsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trap Detection</CardTitle>
          <CardDescription>Loading blocklist data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add New Block Rule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Add Block Rule</span>
          </CardTitle>
          <CardDescription>
            Add text patterns to block across all pairs or specific pairs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scope">Scope</Label>
            <Select value={selectedPair} onValueChange={setSelectedPair}>
              <SelectTrigger>
                <SelectValue placeholder="Select scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global (All Pairs)</SelectItem>
                {pairs.map((pair: Pair) => (
                  <SelectItem key={pair.id} value={pair.id.toString()}>
                    {pair.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="blockText">Text to Block</Label>
            <div className="flex space-x-2">
              <Input
                id="blockText"
                placeholder="Enter text pattern to block..."
                value={newBlockText}
                onChange={(e) => setNewBlockText(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAddBlock()}
              />
              <Button 
                onClick={handleAddBlock}
                disabled={addBlocklistMutation.isPending || !newBlockText.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Known Trap Patterns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <span>Known Trap Patterns</span>
          </CardTitle>
          <CardDescription>
            Common trap patterns detected automatically by the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {trapPatterns.map((trap, index) => (
              <div key={index} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <code className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {trap.pattern}
                    </code>
                    <p className="text-sm text-muted-foreground mt-1">
                      {trap.description}
                    </p>
                  </div>
                  <Badge variant="secondary">Auto-detect</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Global Blocklist */}
      <Card>
        <CardHeader>
          <CardTitle>Global Blocklist</CardTitle>
          <CardDescription>
            Rules applied to all pairs ({globalBlocks.length} rules)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {globalBlocks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No global blocking rules configured
            </div>
          ) : (
            <div className="space-y-2">
              {globalBlocks.map((block: Blocklist) => (
                <div
                  key={block.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <Badge variant="outline">{block.type}</Badge>
                    <code className="text-sm font-mono">{block.value}</code>
                    {!block.isActive && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteBlocklistMutation.mutate(block.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pair-Specific Blocklists */}
      {pairBlocks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pair-Specific Rules</CardTitle>
            <CardDescription>
              Rules applied to specific pairs ({pairBlocks.length} rules)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pairBlocks.map((block: Blocklist) => {
                const pair = pairs.find((p: Pair) => p.id === block.pairId);
                return (
                  <div
                    key={block.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline">{block.type}</Badge>
                      <code className="text-sm font-mono">{block.value}</code>
                      <Badge variant="secondary">
                        {pair?.name || `Pair ${block.pairId}`}
                      </Badge>
                      {!block.isActive && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteBlocklistMutation.mutate(block.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Detection Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{globalBlocks.length}</div>
              <div className="text-sm text-muted-foreground">Global Rules</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{pairBlocks.length}</div>
              <div className="text-sm text-muted-foreground">Pair Rules</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{trapPatterns.length}</div>
              <div className="text-sm text-muted-foreground">Auto Patterns</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {blocklists.filter((b: Blocklist) => b.isActive).length}
              </div>
              <div className="text-sm text-muted-foreground">Active Rules</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}