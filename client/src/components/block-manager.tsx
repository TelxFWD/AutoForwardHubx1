import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Upload, MessageSquare, Image, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Blocklist {
  id: number;
  type: string;
  value: string;
  pairId: number | null;
  isActive: boolean;
}

interface Pair {
  id: number;
  name: string;
  pairType: string;
}

export default function BlockManager() {
  const [newBlockText, setNewBlockText] = useState("");
  const [selectedPair, setSelectedPair] = useState<string>("global");
  const [activeTab, setActiveTab] = useState("text");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: blocklists = [] } = useQuery<Blocklist[]>({
    queryKey: ["/api/blocklists"],
  });

  const { data: pairs = [] } = useQuery<Pair[]>({
    queryKey: ["/api/pairs"],
  });

  const addBlocklistMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/blocklists", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blocklists"] });
      setNewBlockText("");
      toast({ title: "Block rule added successfully" });
    },
    onError: (error) => {
      toast({ title: "Error adding block rule", description: error.message, variant: "destructive" });
    },
  });

  const deleteBlocklistMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/blocklists/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blocklists"] });
      toast({ title: "Block rule deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error deleting block rule", description: error.message, variant: "destructive" });
    },
  });

  const imageBlockMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/blocklists/image", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blocklists"] });
      toast({ title: "Image added to blocklist" });
    },
    onError: (error) => {
      toast({ title: "Error blocking image", description: error.message, variant: "destructive" });
    },
  });

  const handleAddBlock = () => {
    if (!newBlockText.trim()) return;

    const pairId = selectedPair === "global" ? null : parseInt(selectedPair);
    
    addBlocklistMutation.mutate({
      type: activeTab === "text" ? "text" : activeTab === "headers" ? "header" : "footer",
      value: newBlockText,
      pairId,
      isActive: true,
    });
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const pairId = selectedPair === "global" ? null : parseInt(selectedPair);
    
    // For now, just add a placeholder hash
    imageBlockMutation.mutate({
      pairId,
      fileName: file.name,
    });
  };

  const getFilteredBlocklists = (type: string) => {
    return blocklists.filter((block) => 
      block.type === type && 
      (selectedPair === "global" ? !block.pairId : block.pairId === parseInt(selectedPair))
    );
  };

  const globalBlocks = blocklists.filter((b) => !b.pairId);
  const pairBlocks = blocklists.filter((b) => b.pairId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Block Manager</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pairSelect">Apply to</Label>
            <Select value={selectedPair} onValueChange={setSelectedPair}>
              <SelectTrigger>
                <SelectValue placeholder="Select scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global (All Pairs)</SelectItem>
                {pairs.map((pair) => (
                  <SelectItem key={pair.id} value={pair.id.toString()}>
                    {pair.name} ({pair.pairType})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="text">
                <MessageSquare className="w-4 h-4 mr-2" />
                Text Patterns
              </TabsTrigger>
              <TabsTrigger value="images">
                <Image className="w-4 h-4 mr-2" />
                Image Blocking
              </TabsTrigger>
              <TabsTrigger value="headers">
                <Filter className="w-4 h-4 mr-2" />
                Strip Rules
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="blockText">Text Pattern to Block</Label>
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

              <div className="space-y-2">
                <h4 className="font-medium">Blocked Text Patterns</h4>
                <div className="space-y-2">
                  {getFilteredBlocklists("text").map((block) => (
                    <div key={block.id} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">{block.value}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteBlocklistMutation.mutate(block.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="images" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="imageUpload">Upload Image to Block</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="imageUpload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Blocked Images</h4>
                <div className="space-y-2">
                  {getFilteredBlocklists("image_hash").map((block) => (
                    <div key={block.id} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm font-mono">{block.value}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteBlocklistMutation.mutate(block.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="headers" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stripText">Strip Rule Pattern</Label>
                <div className="flex space-x-2">
                  <Input
                    id="stripText"
                    placeholder="Enter regex pattern to strip..."
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

              <div className="space-y-2">
                <h4 className="font-medium">Strip Rules</h4>
                <div className="space-y-2">
                  {getFilteredBlocklists("header").concat(getFilteredBlocklists("footer")).map((block) => (
                    <div key={block.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{block.type}</Badge>
                        <span className="text-sm font-mono">{block.value}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteBlocklistMutation.mutate(block.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Block Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{globalBlocks.length}</div>
              <div className="text-sm text-muted-foreground">Global Blocks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{pairBlocks.length}</div>
              <div className="text-sm text-muted-foreground">Pair-Specific Blocks</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}