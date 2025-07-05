import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import AddSessionModal from "@/components/add-session-modal";
import { 
  Play, 
  Pause, 
  Plus, 
  RefreshCw, 
  Trash2, 
  Users, 
  MessageSquare, 
  Shield, 
  Image,
  AlertTriangle,
  Activity,
  Settings,
  Upload,
  Edit3,
  Eye,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";

interface User {
  user_id: string;
  session_file: string;
  status: "active" | "paused" | "invalid";
  pairs: Pair[];
  total_pairs: number;
  trap_hits: number;
}

interface Pair {
  source: string;
  destination: string;
  strip_rules: {
    remove_mentions: boolean;
    header_patterns: string[];
    footer_patterns: string[];
  };
}

interface BlockedImage {
  hash: string;
  filename: string;
  blocked_at: string;
}

interface TrapLog {
  id: string;
  user_id: string;
  message_preview: string;
  trap_type: string;
  timestamp: string;
  source_channel: string;
}

export default function TelXPage() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddPair, setShowAddPair] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showEditPair, setShowEditPair] = useState(false);
  const [editingPair, setEditingPair] = useState<any>(null);
  const [showBlocklistManager, setShowBlocklistManager] = useState(false);
  const [copierStatus, setCopierStatus] = useState<"running" | "stopped">("stopped");
  const [showAddSession, setShowAddSession] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch real sessions from the database
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['/api/sessions'],
    refetchInterval: 30000,
  });

  // Fetch copier users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/copier/users'],
    refetchInterval: 30000, // Reduced from 5000 to 30000 (30 seconds)
  });

  // Fetch blocked images
  const { data: blockedImages = [], isLoading: imagesLoading } = useQuery({
    queryKey: ['/api/block/images'],
    refetchInterval: 60000, // Reduced refresh frequency to 60 seconds
  });

  // Fetch trap logs
  const { data: trapLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['/api/logs/traps'],
    refetchInterval: 30000, // Reduced from 5000 to 30000 (30 seconds)
  });

  // Type-safe data
  const typedUsers = users as User[];
  const typedBlockedImages = blockedImages as BlockedImage[];
  const typedTrapLogs = trapLogs as TrapLog[];

  // Start/Stop Copier Mutations
  const startCopierMutation = useMutation({
    mutationFn: () => apiRequest('/api/start/copier', { method: 'POST' }),
    onSuccess: () => {
      setCopierStatus("running");
      toast({ title: "Success", description: "Telegram copier started successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/copier/users'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const stopCopierMutation = useMutation({
    mutationFn: () => apiRequest('/api/stop/copier', { method: 'POST' }),
    onSuccess: () => {
      setCopierStatus("stopped");
      toast({ title: "Success", description: "Telegram copier stopped successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/copier/users'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // User session management mutations
  const pauseUserMutation = useMutation({
    mutationFn: (userId: string) => apiRequest(`/api/copier/users/${userId}/pause`, { method: 'POST' }),
    onSuccess: () => {
      toast({ title: "Success", description: "User session paused successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/copier/users'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resumeUserMutation = useMutation({
    mutationFn: (userId: string) => apiRequest(`/api/copier/users/${userId}/resume`, { method: 'POST' }),
    onSuccess: () => {
      toast({ title: "Success", description: "User session resumed successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/copier/users'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => apiRequest(`/api/copier/users/${userId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: "Success", description: "User session deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/copier/users'] });
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });





  // Pair management mutations
  const addPairMutation = useMutation({
    mutationFn: (pairData: any) => fetch(`/api/copier/add-pair/${selectedUser}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pairData),
    }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Success", description: "Pair added successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/copier/users'] });
      setShowAddPair(false);
    },
  });

  const updatePairMutation = useMutation({
    mutationFn: (pairData: any) => fetch(`/api/copier/update-pair/${selectedUser}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pairData),
    }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Success", description: "Pair updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/copier/users'] });
      setShowEditPair(false);
      setEditingPair(null);
    },
  });

  const deletePairMutation = useMutation({
    mutationFn: (pairIndex: number) => fetch(`/api/copier/delete-pair/${selectedUser}/${pairIndex}`, {
      method: 'DELETE',
    }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Success", description: "Pair deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/copier/users'] });
    },
  });

  // Blocklist mutations
  const addBlockedTextMutation = useMutation({
    mutationFn: (text: string) => fetch('/api/block/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Success", description: "Text pattern added to blocklist" });
      queryClient.invalidateQueries({ queryKey: ['/api/block/images'] });
    },
  });

  const addBlockedImageMutation = useMutation({
    mutationFn: (formData: FormData) => fetch('/api/block/image', {
      method: 'POST',
      body: formData,
    }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Success", description: "Image added to blocklist" });
      queryClient.invalidateQueries({ queryKey: ['/api/block/images'] });
      setShowImageUpload(false);
    },
  });

  const removeBlockedItemMutation = useMutation({
    mutationFn: (hash: string) => fetch(`/api/block/remove/${hash}`, {
      method: 'DELETE',
    }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Success", description: "Item removed from blocklist" });
      queryClient.invalidateQueries({ queryKey: ['/api/block/images'] });
    },
  });

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case "active":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "paused":
        return <Pause className="w-4 h-4 text-yellow-500" />;
      case "invalid":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const UserSessionCard = ({ user }: { user: User }) => (
    <Card className={`cursor-pointer transition-all ${selectedUser === user.user_id ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setSelectedUser(user.user_id)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            {user.user_id}
          </CardTitle>
          <div className="flex items-center gap-2">
            <StatusIcon status={user.status} />
            <Badge variant={user.status === "active" ? "default" : user.status === "paused" ? "secondary" : "destructive"}>
              {user.status}
            </Badge>
          </div>
        </div>
        <CardDescription>Session: {user.session_file}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between text-sm text-gray-600">
          <span>{user.total_pairs} pairs</span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" />
            {user.trap_hits} traps
          </span>
        </div>
        <div className="flex gap-2 mt-3">
          {user.status === "paused" ? (
            <Button 
              type="button"
              size="sm" 
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                resumeUserMutation.mutate(user.user_id);
              }}
            >
              <Play className="w-4 h-4 mr-1" />
              Resume
            </Button>
          ) : (
            <Button 
              type="button"
              size="sm" 
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                pauseUserMutation.mutate(user.user_id);
              }}
            >
              <Pause className="w-4 h-4 mr-1" />
              Pause
            </Button>
          )}
          <Button 
            type="button"
            size="sm" 
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              deleteUserMutation.mutate(user.user_id);
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const PairCard = ({ pair, userId, pairIndex }: { pair: Pair; userId: string; pairIndex: number }) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-md flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          {pair.source} → {pair.destination}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Switch checked={pair.strip_rules.remove_mentions} disabled />
            <Label>Remove Mentions</Label>
          </div>
          {pair.strip_rules.header_patterns.length > 0 && (
            <div>
              <Label className="text-xs text-gray-500">Header Patterns:</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {pair.strip_rules.header_patterns.map((pattern, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">{pattern}</Badge>
                ))}
              </div>
            </div>
          )}
          {pair.strip_rules.footer_patterns.length > 0 && (
            <div>
              <Label className="text-xs text-gray-500">Footer Patterns:</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {pair.strip_rules.footer_patterns.map((pattern, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">{pattern}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          <Button 
            type="button"
            size="sm" 
            variant="outline"
            onClick={() => {
              setEditingPair({ ...pair, index: pairIndex });
              setShowEditPair(true);
            }}
          >
            <Edit3 className="w-4 h-4 mr-1" />
            Edit
          </Button>
          <Button 
            type="button"
            size="sm" 
            variant="destructive"
            onClick={() => {
              if (confirm('Are you sure you want to delete this pair?')) {
                deletePairMutation.mutate(pairIndex);
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const AddUserDialog = () => {
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState<"phone" | "otp">("phone");
    const [loading, setLoading] = useState(false);

    const requestOtp = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/sessions/request-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
        });
        const result = await response.json();
        if (result.success !== false) {
          setStep("otp");
          toast({ title: "OTP Sent", description: "Check your Telegram for the verification code" });
        } else {
          throw new Error(result.message || "Failed to send OTP");
        }
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    const verifyOtp = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/sessions/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, otp }),
        });
        const result = await response.json();
        if (result.success !== false) {
          toast({ title: "Success", description: "User session created successfully" });
          queryClient.invalidateQueries({ queryKey: ['/api/copier/users'] });
          setShowAddUser(false);
          setPhone("");
          setOtp("");
          setStep("phone");
        } else {
          throw new Error(result.message || "Failed to verify OTP");
        }
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    return (
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User Session</DialogTitle>
            <DialogDescription>
              {step === "phone" 
                ? "Enter your phone number to create a new Telegram session"
                : "Enter the OTP code sent to your Telegram"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {step === "phone" ? (
              <>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    placeholder="+1234567890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <Button type="button" onClick={requestOtp} disabled={loading || !phone}>
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                  Send OTP
                </Button>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="otp">Verification Code</Label>
                  <Input
                    id="otp"
                    placeholder="12345"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep("phone")}>
                    Back
                  </Button>
                  <Button type="button" onClick={verifyOtp} disabled={loading || !otp}>
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                    Verify & Create
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const AddPairDialog = () => {
    const [source, setSource] = useState("");
    const [destination, setDestination] = useState("");
    const [removeMentions, setRemoveMentions] = useState(true);
    const [headerPatterns, setHeaderPatterns] = useState("");
    const [footerPatterns, setFooterPatterns] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
      if (!source || !destination || !selectedUser) return;
      
      setLoading(true);
      try {
        const pairData = {
          source,
          destination,
          strip_rules: {
            remove_mentions: removeMentions,
            header_patterns: headerPatterns.split(',').map((p: string) => p.trim()).filter((p: string) => p),
            footer_patterns: footerPatterns.split(',').map((p: string) => p.trim()).filter((p: string) => p)
          }
        };
        
        await addPairMutation.mutateAsync(pairData);
        
        // Reset form
        setSource("");
        setDestination("");
        setRemoveMentions(true);
        setHeaderPatterns("");
        setFooterPatterns("");
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    return (
      <Dialog open={showAddPair} onOpenChange={setShowAddPair}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Pair</DialogTitle>
            <DialogDescription>
              Create a new forwarding pair for {selectedUser}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="source">Source Channel</Label>
              <Input
                id="source"
                placeholder="@source_channel or -1001234567890"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="destination">Destination Channel</Label>
              <Input
                id="destination"
                placeholder="@destination_channel or -1001234567890"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="removeMentions"
                checked={removeMentions}
                onCheckedChange={setRemoveMentions}
              />
              <Label htmlFor="removeMentions">Remove @mentions</Label>
            </div>
            <div>
              <Label htmlFor="headerPatterns">Header Patterns (comma-separated)</Label>
              <Input
                id="headerPatterns"
                placeholder="^#\w+, ^(⭐|🔥|VIP|ENTRY)\b"
                value={headerPatterns}
                onChange={(e) => setHeaderPatterns(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="footerPatterns">Footer Patterns (comma-separated)</Label>
              <Input
                id="footerPatterns"
                placeholder="shared by .*, auto copy.*"
                value={footerPatterns}
                onChange={(e) => setFooterPatterns(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddPair(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={loading || !source || !destination}>
                {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Pair
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const EditPairDialog = () => {
    const [source, setSource] = useState(editingPair?.source || "");
    const [destination, setDestination] = useState(editingPair?.destination || "");
    const [removeMentions, setRemoveMentions] = useState(editingPair?.strip_rules?.remove_mentions || true);
    const [headerPatterns, setHeaderPatterns] = useState(editingPair?.strip_rules?.header_patterns?.join(', ') || "");
    const [footerPatterns, setFooterPatterns] = useState(editingPair?.strip_rules?.footer_patterns?.join(', ') || "");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
      if (!source || !destination || !selectedUser || !editingPair) return;
      
      setLoading(true);
      try {
        const pairData = {
          index: editingPair.index,
          source,
          destination,
          strip_rules: {
            remove_mentions: removeMentions,
            header_patterns: headerPatterns.split(',').map((p: string) => p.trim()).filter((p: string) => p),
            footer_patterns: footerPatterns.split(',').map((p: string) => p.trim()).filter((p: string) => p)
          }
        };
        
        await updatePairMutation.mutateAsync(pairData);
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    return (
      <Dialog open={showEditPair} onOpenChange={setShowEditPair}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Pair</DialogTitle>
            <DialogDescription>
              Modify forwarding pair for {selectedUser}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editSource">Source Channel</Label>
              <Input
                id="editSource"
                placeholder="@source_channel or -1001234567890"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="editDestination">Destination Channel</Label>
              <Input
                id="editDestination"
                placeholder="@destination_channel or -1001234567890"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="editRemoveMentions"
                checked={removeMentions}
                onCheckedChange={setRemoveMentions}
              />
              <Label htmlFor="editRemoveMentions">Remove @mentions</Label>
            </div>
            <div>
              <Label htmlFor="editHeaderPatterns">Header Patterns (comma-separated)</Label>
              <Input
                id="editHeaderPatterns"
                placeholder="^#\w+, ^(⭐|🔥|VIP|ENTRY)\b"
                value={headerPatterns}
                onChange={(e) => setHeaderPatterns(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="editFooterPatterns">Footer Patterns (comma-separated)</Label>
              <Input
                id="editFooterPatterns"
                placeholder="shared by .*, auto copy.*"
                value={footerPatterns}
                onChange={(e) => setFooterPatterns(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowEditPair(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={loading || !source || !destination}>
                {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                Update Pair
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const BlocklistManagerDialog = () => {
    const [newTextPattern, setNewTextPattern] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("text");

    const handleAddText = async () => {
      if (!newTextPattern.trim()) return;
      
      setLoading(true);
      try {
        await addBlockedTextMutation.mutateAsync(newTextPattern.trim());
        setNewTextPattern("");
        toast({ title: "Success", description: "Text pattern added to blocklist" });
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    const handleAddImage = async () => {
      if (!selectedFile) return;
      
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('image', selectedFile);
        await addBlockedImageMutation.mutateAsync(formData);
        setSelectedFile(null);
        toast({ title: "Success", description: "Image added to blocklist" });
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    // Predefined common patterns for easy addition
    const commonPatterns = [
      "/ *", "1", "leak", "trap", "edit this", "scam", "fake", "spam",
      "^leak", ".*trap.*", "porn", "nude", "18+", "adult"
    ];

    return (
      <Dialog open={showBlocklistManager} onOpenChange={setShowBlocklistManager}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Advanced Blocklist Manager
            </DialogTitle>
            <DialogDescription>
              Manage blocked text patterns, images, and content filtering rules for all users
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Text Patterns & Words
              </TabsTrigger>
              <TabsTrigger value="images" className="flex items-center gap-2">
                <Image className="w-4 h-4" />
                Image Blocking
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="text" className="space-y-6">
              {/* Add new pattern section */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="font-medium mb-3 text-blue-900 dark:text-blue-100">Add New Text Pattern</h4>
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Enter text pattern, word, or regex (e.g., 'trap', '/ *', '^leak.*')"
                    value={newTextPattern}
                    onChange={(e) => setNewTextPattern(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddText()}
                    className="flex-1"
                  />
                  <Button type="button" onClick={handleAddText} disabled={loading || !newTextPattern.trim()}>
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add Pattern
                  </Button>
                </div>
                
                {/* Quick add common patterns */}
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-blue-800 dark:text-blue-200">Quick Add Common Patterns:</h5>
                  <div className="flex flex-wrap gap-2">
                    {commonPatterns.map((pattern, idx) => (
                      <Button
                        key={idx}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setNewTextPattern(pattern)}
                        className="text-xs h-7 bg-white hover:bg-blue-100 border-blue-200"
                      >
                        {pattern}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Current patterns display */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Active Text Patterns ({["/ *", "1", "leak", "trap", "edit this"].length})</h4>
                  <Badge variant="secondary" className="px-3 py-1">
                    Global Rules
                  </Badge>
                </div>
                <div className="grid gap-2 max-h-60 overflow-y-auto">
                  {["/ *", "1", "leak", "trap", "edit this"].map((pattern, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border shadow-sm">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono text-xs">REGEX</Badge>
                        <code className="text-sm font-medium">{pattern}</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          Added: Today
                        </Badge>
                        <Button 
                          type="button"
                          size="sm" 
                          variant="destructive"
                          onClick={() => removeBlockedItemMutation.mutate(pattern)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="images" className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
                <Button type="button" onClick={handleAddImage} disabled={loading || !selectedFile}>
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                </Button>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Blocked Images:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(blockedImages as any[]).map((image: any) => (
                    <div key={image.hash} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Image className="w-4 h-4" />
                          <span className="text-sm font-medium">{image.filename}</span>
                        </div>
                        <Button 
                          type="button"
                          size="sm" 
                          variant="destructive"
                          onClick={() => removeBlockedItemMutation.mutate(image.hash)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Hash: {image.hash.substring(0, 20)}...
                      </div>
                      <div className="text-xs text-gray-500">
                        Blocked: {new Date(image.blocked_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => setShowBlocklistManager(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="p-6 space-y-6">
        {/* Enhanced Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                TelX - Telegram Copier
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2 text-lg">
                Advanced multi-user Telegram-to-Telegram message forwarding with AI-powered content filtering
              </p>
              <div className="flex items-center gap-4 mt-3">
                <Badge variant="secondary" className="px-3 py-1">
                  <Users className="w-4 h-4 mr-1" />
                  {typedUsers.length} Active Users
                </Badge>
                <Badge variant="secondary" className="px-3 py-1">
                  <Shield className="w-4 h-4 mr-1" />
                  {typedBlockedImages.length} Blocked Items
                </Badge>
                <Badge variant={copierStatus === "running" ? "default" : "secondary"} className="px-3 py-1">
                  <Activity className="w-4 h-4 mr-1" />
                  {copierStatus === "running" ? "System Online" : "System Offline"}
                </Badge>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => setShowBlocklistManager(true)}
                variant="outline"
                className="bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700"
              >
                <Shield className="w-4 h-4 mr-2" />
                Blocklist Manager
              </Button>
              <Button
                type="button"
                onClick={() => setShowAddUser(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add User Session
              </Button>
              <Button
                type="button"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/copier/users'] })}
                variant="outline"
                className="bg-gray-50 hover:bg-gray-100"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Enhanced Global Controls */}
        <Card className="bg-white dark:bg-gray-800 shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-gray-700 dark:to-gray-600 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-gray-800 dark:text-white">
              <Settings className="w-5 h-5" />
              Global System Controls
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300">
              Manage the entire copier system and monitor real-time status
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-4 items-center">
              <Button
                type="button"
                onClick={() => startCopierMutation.mutate()}
                disabled={copierStatus === "running" || startCopierMutation.isPending}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg px-6 py-2"
              >
                {startCopierMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Start Global Copier
              </Button>
              <Button
                type="button"
                onClick={() => stopCopierMutation.mutate()}
                disabled={copierStatus === "stopped" || stopCopierMutation.isPending}
                className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg px-6 py-2"
              >
                {stopCopierMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Pause className="w-4 h-4 mr-2" />
                )}
                Stop Global Copier
              </Button>
              <div className="flex items-center gap-2 ml-4">
                <div className={`w-3 h-3 rounded-full ${copierStatus === "running" ? "bg-green-500 animate-pulse" : "bg-gray-400"}`}></div>
                <Badge variant={copierStatus === "running" ? "default" : "secondary"} className="px-4 py-2 text-sm">
                  <Activity className="w-4 h-4 mr-1" />
                  System {copierStatus === "running" ? "Online" : "Offline"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

      <Tabs defaultValue="sessions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-white dark:bg-gray-800 shadow-sm">
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            User Sessions
          </TabsTrigger>
          <TabsTrigger value="pairs" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Pair Management
          </TabsTrigger>
          <TabsTrigger value="images" className="flex items-center gap-2">
            <Image className="w-4 h-4" />
            Image Blocking
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Trap Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          {usersLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-3 bg-gray-200 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : typedUsers.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No User Sessions</h3>
                <p className="text-gray-500 mb-4">Create your first Telegram user session to get started.</p>
                <Button onClick={() => setShowAddUser(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add User Session
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {typedUsers.map((user: User) => (
                <UserSessionCard key={user.user_id} user={user} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pairs" className="space-y-4">
          {/* Always show the Add Pair button prominently */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {selectedUser ? `Managing Pairs for: ${selectedUser}` : "Pair Management"}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedUser ? "Configure source to destination forwarding pairs" : "Select a user from the Sessions tab to manage their pairs"}
                </p>
              </div>
              <div className="flex gap-3">
                <Button 
                  onClick={() => setShowBlocklistManager(true)} 
                  variant="outline"
                  className="bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Blocklist Manager
                </Button>
                <Button 
                  onClick={() => setShowAddPair(true)}
                  disabled={!selectedUser}
                  className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Pair
                </Button>
              </div>
            </div>
          </div>

          {selectedUser ? (
            <div className="space-y-4">
              {typedUsers.find((u: User) => u.user_id === selectedUser)?.pairs.length === 0 ? (
                <Card className="border-dashed border-2 border-gray-300 dark:border-gray-600">
                  <CardContent className="text-center py-8">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Pairs Yet</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      Create your first forwarding pair for {selectedUser}
                    </p>
                    <Button type="button" onClick={() => setShowAddPair(true)} className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Pair
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {typedUsers.find((u: User) => u.user_id === selectedUser)?.pairs.map((pair: Pair, idx: number) => (
                    <PairCard key={idx} pair={pair} userId={selectedUser} pairIndex={idx} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Card className="border-dashed border-2 border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20">
              <CardContent className="text-center py-12">
                <Users className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-blue-900 dark:text-blue-100 mb-2">Select a User Session</h3>
                <p className="text-blue-600 dark:text-blue-300 mb-6">
                  Go to the "User Sessions" tab and click on a user to manage their forwarding pairs
                </p>
                <Button 
                  type="button"
                  onClick={() => {
                    // Switch to sessions tab (you can implement tab switching here)
                    const sessionsTab = document.querySelector('[value="sessions"]') as HTMLElement;
                    if (sessionsTab) sessionsTab.click();
                  }}
                  variant="outline"
                  className="bg-blue-100 hover:bg-blue-200 border-blue-300 text-blue-700"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Go to Sessions Tab
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="images" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Blocked Images</h3>
            <Button type="button" onClick={() => setShowImageUpload(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Image
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {typedBlockedImages.map((image: BlockedImage) => (
              <Card key={image.hash}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    {image.filename}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Hash: {image.hash.substring(0, 16)}...</div>
                    <div>Blocked: {new Date(image.blocked_at).toLocaleDateString()}</div>
                  </div>
                  <Button type="button" size="sm" variant="destructive" className="mt-2">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Trap Detection Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {typedTrapLogs.map((log: TrapLog) => (
                  <div key={log.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="destructive">{log.trap_type}</Badge>
                          <span className="text-sm text-gray-500">{log.user_id}</span>
                          <span className="text-sm text-gray-500">{log.source_channel}</span>
                        </div>
                        <p className="text-sm text-gray-700">{log.message_preview}</p>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

        <AddUserDialog />
        <AddPairDialog />
        <EditPairDialog />
        <BlocklistManagerDialog />
        
        {/* Add Session Modal */}
        <AddSessionModal 
          isOpen={showAddSession} 
          onClose={() => setShowAddSession(false)} 
        />
      </div>
    </div>
  );
}