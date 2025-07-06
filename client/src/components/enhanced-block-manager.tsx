import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Shield, Plus, X, Image, MessageSquare, Filter, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Blocklist, Pair } from "@shared/schema";

export default function EnhancedBlockManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newBlockText, setNewBlockText] = useState("");
  const [newHeaderPattern, setNewHeaderPattern] = useState("");
  const [newFooterPattern, setNewFooterPattern] = useState("");
  const [selectedPair, setSelectedPair] = useState<string>("global");
  const [blockType, setBlockType] = useState<string>("word");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: blocklists = [], isLoading: blocklistsLoading } = useQuery<Blocklist[]>({
    queryKey: ["/api/blocklists"],
    refetchInterval: 30000,
  });

  const { data: pairs = [] } = useQuery<Pair[]>({
    queryKey: ["/api/pairs"],
  });

  const addBlocklistMutation = useMutation({
    mutationFn: (data: { type: string; value: string; pairId?: number }) =>
      apiRequest("POST", "/api/blocklists", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blocklists"] });
      setNewBlockText("");
      setNewHeaderPattern("");
      setNewFooterPattern("");
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

  const addImageBlockMutation = useMutation({
    mutationFn: (formData: FormData) =>
      fetch("/api/blocklists/image", {
        method: "POST",
        body: formData,
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blocklists"] });
      setSelectedFile(null);
      toast({
        title: "Image block added",
        description: "Image has been added to blocklist.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add image to blocklist.",
        variant: "destructive",
      });
    },
  });

  const handleAddBlock = () => {
    let value = "";
    let type = blockType;
    
    if (blockType === "word" || blockType === "trap_pattern") {
      if (!newBlockText.trim()) {
        toast({
          title: "Invalid input",
          description: "Please enter text to block.",
          variant: "destructive",
        });
        return;
      }
      value = newBlockText.trim();
    } else if (blockType === "header_regex") {
      if (!newHeaderPattern.trim()) {
        toast({
          title: "Invalid input",
          description: "Please enter header pattern.",
          variant: "destructive",
        });
        return;
      }
      value = newHeaderPattern.trim();
    } else if (blockType === "footer_regex") {
      if (!newFooterPattern.trim()) {
        toast({
          title: "Invalid input",
          description: "Please enter footer pattern.",
          variant: "destructive",
        });
        return;
      }
      value = newFooterPattern.trim();
    } else if (blockType === "block_images") {
      value = "enabled";
    }

    const pairId = selectedPair === "global" ? undefined : parseInt(selectedPair);
    addBlocklistMutation.mutate({
      type,
      value,
      pairId,
    });
  };

  const handleAddImage = () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }
    
    const formData = new FormData();
    formData.append("image", selectedFile);
    if (selectedPair !== "global") {
      formData.append("pairId", selectedPair);
    }
    
    addImageBlockMutation.mutate(formData);
  };

  const globalBlocks = blocklists.filter((b: Blocklist) => !b.pairId);
  const pairBlocks = blocklists.filter((b: Blocklist) => b.pairId);

  // Categorize blocklist items
  const textBlocks = globalBlocks.filter(b => b.type === "word" || b.type === "trap_pattern");
  const imageBlocks = globalBlocks.filter(b => b.type === "image_hash" || b.type === "block_images");
  const headerBlocks = globalBlocks.filter(b => b.type === "header_regex");
  const footerBlocks = globalBlocks.filter(b => b.type === "footer_regex");

  if (blocklistsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Block Manager</CardTitle>
          <CardDescription>Loading block manager data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Enhanced Block Manager</span>
          </CardTitle>
          <CardDescription>
            Manage text patterns, image blocking, and strip rules for content filtering
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="text" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="text" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Text Patterns
              </TabsTrigger>
              <TabsTrigger value="images" className="flex items-center gap-2">
                <Image className="w-4 h-4" />
                Image Blocking
              </TabsTrigger>
              <TabsTrigger value="headers" className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Header Rules
              </TabsTrigger>
              <TabsTrigger value="footers" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Footer Rules
              </TabsTrigger>
            </TabsList>

            {/* Scope Selection */}
            <div className="space-y-2">
              <Label htmlFor="pairSelect">Apply to</Label>
              <Select value={selectedPair} onValueChange={setSelectedPair}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (All Pairs)</SelectItem>
                  {pairs.map((pair: Pair) => (
                    <SelectItem key={pair.id} value={pair.id.toString()}>
                      {pair.name} ({pair.pairType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <TabsContent value="text" className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="font-medium mb-3 text-blue-900 dark:text-blue-100">Add Text Pattern</h4>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Select value={blockType} onValueChange={setBlockType}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="word">Word</SelectItem>
                        <SelectItem value="trap_pattern">Trap Pattern</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Enter text pattern to block..."
                      value={newBlockText}
                      onChange={(e) => setNewBlockText(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleAddBlock()}
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleAddBlock}
                      disabled={addBlocklistMutation.isPending || !newBlockText.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Current Text Blocks */}
              <div className="space-y-2">
                <h5 className="font-medium">Current Text Patterns ({textBlocks.length})</h5>
                {textBlocks.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No text patterns configured
                  </div>
                ) : (
                  <div className="space-y-2">
                    {textBlocks.map((block: Blocklist) => (
                      <div key={block.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline">{block.type}</Badge>
                          <code className="text-sm font-mono">{block.value}</code>
                          {!block.isActive && <Badge variant="secondary">Inactive</Badge>}
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
              </div>
            </TabsContent>

            <TabsContent value="images" className="space-y-4">
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                <h4 className="font-medium mb-3 text-orange-900 dark:text-orange-100">Image Blocking Controls</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h5 className="font-medium">Block All Images</h5>
                      <p className="text-sm text-muted-foreground">Prevent all images from being forwarded</p>
                    </div>
                    <Button
                      onClick={() => {
                        setBlockType("block_images");
                        handleAddBlock();
                      }}
                      variant="outline"
                      disabled={addBlocklistMutation.isPending}
                    >
                      Enable Block
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    <h5 className="font-medium">Upload Image to Block</h5>
                    <div className="flex gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="flex-1"
                      />
                      <Button 
                        onClick={handleAddImage}
                        disabled={addImageBlockMutation.isPending || !selectedFile}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Image Blocks */}
              <div className="space-y-2">
                <h5 className="font-medium">Current Image Blocks ({imageBlocks.length})</h5>
                {imageBlocks.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No image blocks configured
                  </div>
                ) : (
                  <div className="space-y-2">
                    {imageBlocks.map((block: Blocklist) => (
                      <div key={block.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline">{block.type}</Badge>
                          <code className="text-sm font-mono">{block.value}</code>
                          {!block.isActive && <Badge variant="secondary">Inactive</Badge>}
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
              </div>
            </TabsContent>

            <TabsContent value="headers" className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <h4 className="font-medium mb-3 text-green-900 dark:text-green-100">Header Strip Rules</h4>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter regex pattern for headers to strip..."
                      value={newHeaderPattern}
                      onChange={(e) => setNewHeaderPattern(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          setBlockType("header_regex");
                          handleAddBlock();
                        }
                      }}
                      className="flex-1"
                    />
                    <Button 
                      onClick={() => {
                        setBlockType("header_regex");
                        handleAddBlock();
                      }}
                      disabled={addBlocklistMutation.isPending || !newHeaderPattern.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Example: <code>^VIP.*|^PREMIUM.*</code> (strips lines starting with VIP or PREMIUM)
                  </p>
                </div>
              </div>

              {/* Current Header Rules */}
              <div className="space-y-2">
                <h5 className="font-medium">Current Header Rules ({headerBlocks.length})</h5>
                {headerBlocks.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No header rules configured
                  </div>
                ) : (
                  <div className="space-y-2">
                    {headerBlocks.map((block: Blocklist) => (
                      <div key={block.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline">{block.type}</Badge>
                          <code className="text-sm font-mono">{block.value}</code>
                          {!block.isActive && <Badge variant="secondary">Inactive</Badge>}
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
              </div>
            </TabsContent>

            <TabsContent value="footers" className="space-y-4">
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <h4 className="font-medium mb-3 text-purple-900 dark:text-purple-100">Footer Strip Rules</h4>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter regex pattern for footers to strip..."
                      value={newFooterPattern}
                      onChange={(e) => setNewFooterPattern(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          setBlockType("footer_regex");
                          handleAddBlock();
                        }
                      }}
                      className="flex-1"
                    />
                    <Button 
                      onClick={() => {
                        setBlockType("footer_regex");
                        handleAddBlock();
                      }}
                      disabled={addBlocklistMutation.isPending || !newFooterPattern.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Example: <code>Join.*@.*|Follow.*channel</code> (strips promotional footers)
                  </p>
                </div>
              </div>

              {/* Current Footer Rules */}
              <div className="space-y-2">
                <h5 className="font-medium">Current Footer Rules ({footerBlocks.length})</h5>
                {footerBlocks.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No footer rules configured
                  </div>
                ) : (
                  <div className="space-y-2">
                    {footerBlocks.map((block: Blocklist) => (
                      <div key={block.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline">{block.type}</Badge>
                          <code className="text-sm font-mono">{block.value}</code>
                          {!block.isActive && <Badge variant="secondary">Inactive</Badge>}
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
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Pair-Specific Rules Summary */}
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
    </div>
  );
}