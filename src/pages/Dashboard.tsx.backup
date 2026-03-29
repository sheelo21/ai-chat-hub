import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Bot, LogOut, Settings, RefreshCw, Copy, Search, Filter, Layout, Trash2, GripVertical, ArrowUpDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  welcome_message?: string;
  ai_character?: string;
  primary_color?: string;
};

const Dashboard = () => {
  const { user, signOut, loading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  
  // 検索・フィルター状態
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortBy, setSortBy] = useState<"name" | "created" | "updated">("updated");
  const [draggedProject, setDraggedProject] = useState<string | null>(null);

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
      welcome_message: "こんにちは！どのようなご用件でしょうか？",
      ai_character: "あなたは親切で丁寧なAIアシスタントです。ユーザーの質問に分かりやすく答えてください。",
      primary_color: "#0ea5e9",
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

  const handleClone = async (project: Project) => {
    if (!user) return;
    const { error } = await supabase.from("projects").insert({
      name: `${project.name} (コピー)`,
      description: project.description,
      user_id: user.id,
      target_urls: project.target_urls,
      welcome_message: project.welcome_message || "こんにちは！どのようなご用件でしょうか？",
      ai_character: project.ai_character || "あなたは親切で丁寧なAIアシスタントです。",
      primary_color: project.primary_color || "#0ea5e9",
    });
    if (error) {
      toast({ title: "エラー", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "プロジェクトをコピーしました" });
      fetchProjects();
    }
  };

  // プロジェクト削除機能
  const handleDeleteProject = async (projectId: string) => {
    if (!confirm("本当に削除しますか？この操作は元に戻せません。")) return;
    
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);
    
    if (error) {
      toast({ title: "エラー", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "プロジェクトを削除しました" });
      fetchProjects();
    }
  };

  // ドラッグ＆ドロップ機能
  const handleDragStart = (projectId: string) => {
    setDraggedProject(projectId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetProjectId: string) => {
    e.preventDefault();
    if (!draggedProject || draggedProject === targetProjectId) {
      setDraggedProject(null);
      return;
    }

    // プロジェクトの順序を入れ替える（簡易的な実装）
    const draggedIndex = projects.findIndex(p => p.id === draggedProject);
    const targetIndex = projects.findIndex(p => p.id === targetProjectId);
    
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedProject(null);
      return;
    }

    const newProjects = [...projects];
    const [draggedItem] = newProjects.splice(draggedIndex, 1);
    newProjects.splice(targetIndex, 0, draggedItem);
    
    setProjects(newProjects);
    setDraggedProject(null);
    
    // DBに順序を保存する（必要に応じてorderカラムを追加）
    toast({ title: "プロジェクトの順序を変更しました" });
  };

  // フィルター・ソート処理
  const filteredAndSortedProjects = projects
    .filter(project => {
      const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      const matchesStatus = statusFilter === "all" ||
                           (statusFilter === "active" && project.is_active) ||
                           (statusFilter === "inactive" && !project.is_active);
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "created":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "updated":
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

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
            <h1 className="text-lg font-semibold">AI Chat Hub</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            ログアウト
          </Button>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold">プロジェクト一覧</h2>
            <p className="text-muted-foreground">チャットボットプロジェクトを管理</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {isAdmin && (
              <Button variant="outline" onClick={() => navigate("/dashboard/templates")} className="w-full sm:w-auto">
                <Layout className="mr-2 h-4 w-4" />
                テンプレート
              </Button>
            )}
            {isAdmin && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto">
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
        </div>

        {/* 検索・フィルター・ソート */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="プロジェクト名や説明で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={statusFilter} onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}>
              <SelectTrigger className="w-[140px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="active">稼働中</SelectItem>
                <SelectItem value="inactive">停止</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value: "name" | "created" | "updated") => setSortBy(value)}>
              <SelectTrigger className="w-[140px]">
                <ArrowUpDown className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">更新日順</SelectItem>
                <SelectItem value="created">作成日順</SelectItem>
                <SelectItem value="name">名前順</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredAndSortedProjects.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <Bot className="mb-4 h-12 w-12 text-muted-foreground" />
            <CardTitle className="mb-2">
              {projects.length === 0 ? "プロジェクトがありません" : "条件に一致するプロジェクトがありません"}
            </CardTitle>
            <CardDescription>
              {projects.length === 0 
                ? "「新規作成」ボタンからチャットボットを作成しましょう"
                : "検索条件を変更してください"
              }
            </CardDescription>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAndSortedProjects.map((project, index) => (
              <Card 
                key={project.id} 
                className="group cursor-pointer transition-all hover:shadow-md"
                draggable={isAdmin}
                onDragStart={() => isAdmin && handleDragStart(project.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => isAdmin && handleDrop(e, project.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {isAdmin && <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />}
                      <CardTitle className="text-base">{project.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={project.is_active ? "default" : "secondary"}>
                        {project.is_active ? "稼働中" : "停止"}
                      </Badge>
                    </div>
                  </div>
                  {project.description && (
                    <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                    <span>URL: {project.target_urls.length}件</span>
                    <span>{format(new Date(project.updated_at), "yyyy/MM/dd")}</span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/dashboard/project/${project.id}`);
                      }}
                    >
                      <Settings className="mr-2 h-3 w-3" />
                      設定
                    </Button>
                    {isAdmin && (
                      <Button 
                        variant="outline" 
                        size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClone(project);
                      }}
                    >
                      <Copy className="mr-2 h-3 w-3" />
                      コピー
                    </Button>
                    )}
                    {isAdmin && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(project.id);
                        }}
                      >
                        <Trash2 className="mr-2 h-3 w-3" />
                        削除
                      </Button>
                    )}
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
