import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Bot, LogOut, Settings, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Project = {
  id: string;
  name: string;
  description: string | null;
  target_urls: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const Dashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const fetchProjects = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setProjects((data as Project[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchProjects();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreating(true);
    const { error } = await supabase.from("projects").insert({
      name: newName,
      description: newDesc || null,
      user_id: user.id,
    });
    setCreating(false);
    if (error) {
      toast({ title: "エラー", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "プロジェクト作成完了" });
      setDialogOpen(false);
      setNewName("");
      setNewDesc("");
      fetchProjects();
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-semibold">AI Chatbot Manager</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            ログアウト
          </Button>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">プロジェクト一覧</h2>
            <p className="text-muted-foreground">チャットボットプロジェクトを管理</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                新規作成
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新しいプロジェクト</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>プロジェクト名</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="例: ○○株式会社サポートボット" />
                </div>
                <div className="space-y-2">
                  <Label>説明（任意）</Label>
                  <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="プロジェクトの概要" />
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  作成
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {projects.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <Bot className="mb-4 h-12 w-12 text-muted-foreground" />
            <CardTitle className="mb-2">プロジェクトがありません</CardTitle>
            <CardDescription>「新規作成」ボタンからチャットボットを作成しましょう</CardDescription>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} className="group cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate(`/dashboard/project/${project.id}`)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <Badge variant={project.is_active ? "default" : "secondary"}>
                      {project.is_active ? "稼働中" : "停止"}
                    </Badge>
                  </div>
                  {project.description && (
                    <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>URL: {project.target_urls.length}件</span>
                    <span>{format(new Date(project.updated_at), "yyyy/MM/dd")}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
