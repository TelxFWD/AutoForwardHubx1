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
  const [copierStatus, setCopierStatus] = useState<"running" | "stopped">("stopped");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch copier users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/copier/users'],
    refetchInterval: 5000,
  });

  // Fetch blocked images
  const { data: blockedImages = [], isLoading: imagesLoading } = useQuery({
    queryKey: ['/api/block/images'],
    refetchInterval: 30000,
  });

  // Fetch trap logs
  const { data: trapLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['/api/logs/traps'],
    refetchInterval: 5000,
  });

  // Start/Stop Copier Mutations
  const startCopierMutation = useMutation({
    mutationFn: () => fetch('/api/start/copier', { method: 'POST' }).then(res => res.json()),
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
    mutationFn: () => fetch('/api/stop/copier', { method: 'POST' }).then(res => res.json()),
    onSuccess: () => {
      setCopierStatus("stopped");
      toast({ title: "Success", description: "Telegram copier stopped successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/copier/users'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // User session mutations
  const pauseUserMutation = useMutation({
    mutationFn: (userId: string) => fetch(`/api/copier/pause/${userId}`, { method: 'POST' }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Success", description: "User paused successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/copier/users'] });
    },
  });

  const resumeUserMutation = useMutation({
    mutationFn: (userId: string) => fetch(`/api/copier/resume/${userId}`, { method: 'POST' }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Success", description: "User resumed successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/copier/users'] });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => fetch(`/api/copier/delete/${userId}`, { method: 'DELETE' }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Success", description: "User deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/copier/users'] });
      setSelectedUser(null);
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

  const PairCard = ({ pair, userId }: { pair: Pair; userId: string }) => (
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
          <Button size="sm" variant="outline">
            <Edit3 className="w-4 h-4 mr-1" />
            Edit
          </Button>
          <Button size="sm" variant="destructive">
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
                <Button onClick={requestOtp} disabled={loading || !phone}>
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
                  <Button variant="outline" onClick={() => setStep("phone")}>
                    Back
                  </Button>
                  <Button onClick={verifyOtp} disabled={loading || !otp}>
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">TelX - Telegram Copier</h1>
          <p className="text-gray-500 mt-1">Multi-user Telegram-to-Telegram message forwarding</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setShowAddUser(true)}
            className="bg-primary text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add User Session
          </Button>
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/copier/users'] })}
            variant="outline"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Global Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Global Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              onClick={() => startCopierMutation.mutate()}
              disabled={copierStatus === "running" || startCopierMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Copier
            </Button>
            <Button
              onClick={() => stopCopierMutation.mutate()}
              disabled={copierStatus === "stopped" || stopCopierMutation.isPending}
              variant="destructive"
            >
              <Pause className="w-4 h-4 mr-2" />
              Stop Copier
            </Button>
            <Badge variant={copierStatus === "running" ? "default" : "secondary"} className="px-3 py-1">
              <Activity className="w-4 h-4 mr-1" />
              {copierStatus === "running" ? "Running" : "Stopped"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="sessions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sessions">User Sessions</TabsTrigger>
          <TabsTrigger value="pairs">Pair Management</TabsTrigger>
          <TabsTrigger value="images">Image Blocking</TabsTrigger>
          <TabsTrigger value="logs">Trap Logs</TabsTrigger>
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
          ) : users.length === 0 ? (
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
              {users.map((user: User) => (
                <UserSessionCard key={user.user_id} user={user} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pairs" className="space-y-4">
          {selectedUser ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Pairs for {selectedUser}</h3>
                <Button onClick={() => setShowAddPair(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Pair
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {users.find((u: User) => u.user_id === selectedUser)?.pairs.map((pair, idx) => (
                  <PairCard key={idx} pair={pair} userId={selectedUser} />
                ))}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a User</h3>
                <p className="text-gray-500">Select a user session from the Sessions tab to manage their pairs.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="images" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Blocked Images</h3>
            <Button onClick={() => setShowImageUpload(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Image
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {blockedImages.map((image: BlockedImage) => (
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
                  <Button size="sm" variant="destructive" className="mt-2">
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
                {trapLogs.map((log: TrapLog) => (
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
    </div>
  );
}