import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, RefreshCw, Copy, Code, Bot, Globe, Sparkles, Clock } from "lucide-react";
import { format } from "date-fns";

type Project = {
  id: string;
  name: string;
  description: string | null;
  target_urls: string[];
  ai_character: string;
  primary_color: string;
  welcome_message: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
};

type CrawlLog = {
  id: string;
  status: string;
  pages_crawled: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
};

const ProjectSettings = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [crawlLogs, setCrawlLogs] = useState<CrawlLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newUrl, setNewUrl] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [aiCharacter, setAiCharacter] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0ea5e9");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [targetUrls, setTargetUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const fetchProject = async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();
    if (data) {
      const p = data as Project;
      setProject(p);
      setName(p.name);
      setDescription(p.description || "");
      setAiCharacter(p.ai_character);
      setPrimaryColor(p.primary_color);
      setWelcomeMessage(p.welcome_message);
      setIsActive(p.is_active);
      setTargetUrls(p.target_urls);
    }
    setLoading(false);
  };

  const fetchCrawlLogs = async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from("crawl_logs")
      .select("*")
      .eq("project_id", projectId)
      .order("started_at", { ascending: false })
      .limit(10);
    setCrawlLogs((data as CrawlLog[]) || []);
  };

  useEffect(() => {
    if (user) {
      fetchProject();
      fetchCrawlLogs();
    }
  }, [user, projectId]);

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({
        name,
        description: description || null,
        ai_character: aiCharacter,
        primary_color: primaryColor,
        welcome_message: welcomeMessage,
        is_active: isActive,
        target_urls: targetUrls,
      })
      .eq("id", projectId);
    setSaving(false);
    if (error) {
      toast({ title: "エラー", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "保存しました" });
      fetchProject();
    }
  };

  const addUrl = () => {
    if (newUrl.trim()) {
      setTargetUrls([...targetUrls, newUrl.trim()]);
      setNewUrl("");
    }
  };

  const removeUrl = (index: number) => {
    setTargetUrls(targetUrls.filter((_, i) => i !== index));
  };

  const handleCrawl = async () => {
    if (!projectId) return;
    const { error } = await supabase.from("crawl_logs").insert({
      project_id: projectId,
      status: "running",
    });
    if (!error) {
      toast({ title: "クローリングを開始しました" });
      fetchCrawlLogs();
      // In a real app, this would trigger an edge function
      // For now, simulate completion after a delay
      setTimeout(async () => {
        await supabase
          .from("crawl_logs")
          .update({ status: "completed", pages_crawled: targetUrls.length, completed_at: new Date().toISOString() })
          .eq("project_id", projectId)
          .eq("status", "running");
        fetchCrawlLogs();
      }, 3000);
    }
  };

  const embedCode = `<iframe
  src="${window.location.origin}/chat/${projectId}"
  style="width: 400px; height: 600px; border: none; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.1);"
  allow="clipboard-write"
></iframe>`;

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    toast({ title: "コピーしました" });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">プロジェクトが見つかりません</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{project.name}</h1>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
            保存
          </Button>
        </div>
      </header>

      <main className="container py-8">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general" className="gap-2"><Bot className="h-4 w-4" />基本設定</TabsTrigger>
            <TabsTrigger value="urls" className="gap-2"><Globe className="h-4 w-4" />対象URL</TabsTrigger>
            <TabsTrigger value="ai" className="gap-2"><Sparkles className="h-4 w-4" />AI設定</TabsTrigger>
            <TabsTrigger value="crawl" className="gap-2"><RefreshCw className="h-4 w-4" />クローリング</TabsTrigger>
            <TabsTrigger value="embed" className="gap-2"><Code className="h-4 w-4" />埋め込み</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>基本設定</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>プロジェクト名</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>説明</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>ウェルカムメッセージ</Label>
                  <Input value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} />
                </div>
                <div className="flex items-center gap-3">
                  <Label>テーマカラー</Label>
                  <Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-16 p-1" />
                  <span className="text-sm text-muted-foreground font-mono">{primaryColor}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  <Label>チャットボットを有効化</Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="urls">
            <Card>
              <CardHeader>
                <CardTitle>対象URL</CardTitle>
                <CardDescription>チャットボットが参照するWebサイトのURLを設定</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUrl())}
                  />
                  <Button onClick={addUrl} variant="secondary">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {targetUrls.map((url, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md border p-3">
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm font-mono truncate">{url}</span>
                      <Button variant="ghost" size="icon" onClick={() => removeUrl(i)} className="shrink-0">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {targetUrls.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">URLが追加されていません</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai">
            <Card>
              <CardHeader>
                <CardTitle>AIキャラクター設定</CardTitle>
                <CardDescription>チャットボットの振る舞いやトーンを設定します</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>システムプロンプト</Label>
                  <Textarea
                    className="min-h-[200px] font-mono text-sm"
                    value={aiCharacter}
                    onChange={(e) => setAiCharacter(e.target.value)}
                    placeholder="例: あなたは○○株式会社のカスタマーサポートです。丁寧で親しみやすい口調で回答してください。"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="crawl">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>クローリング管理</CardTitle>
                    <CardDescription>対象URLから最新情報を取得</CardDescription>
                  </div>
                  <Button onClick={handleCrawl} disabled={targetUrls.length === 0}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    最新情報に更新
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {crawlLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">クローリング履歴はありません</p>
                  ) : (
                    crawlLogs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between rounded-md border p-3">
                        <div className="flex items-center gap-3">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{format(new Date(log.started_at), "yyyy/MM/dd HH:mm")}</p>
                            {log.pages_crawled > 0 && (
                              <p className="text-xs text-muted-foreground">{log.pages_crawled}ページ取得</p>
                            )}
                          </div>
                        </div>
                        <Badge variant={
                          log.status === "completed" ? "default" :
                          log.status === "running" ? "secondary" :
                          log.status === "failed" ? "destructive" : "secondary"
                        }>
                          {log.status === "completed" ? "完了" :
                           log.status === "running" ? "実行中" :
                           log.status === "failed" ? "失敗" : log.status}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="embed">
            <Card>
              <CardHeader>
                <CardTitle>埋め込みコード</CardTitle>
                <CardDescription>このコードをHTMLに貼り付けてチャットボットを埋め込みます</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <pre className="rounded-lg bg-muted p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                    {embedCode}
                  </pre>
                  <Button variant="secondary" size="sm" className="absolute top-2 right-2" onClick={copyEmbed}>
                    <Copy className="mr-2 h-3 w-3" />
                    コピー
                  </Button>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium mb-2">プレビュー</p>
                  <a
                    href={`/chat/${projectId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    チャットボットを別タブで開く →
                  </a>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ProjectSettings;
