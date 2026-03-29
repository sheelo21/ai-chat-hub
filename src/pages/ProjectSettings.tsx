import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Bot } from "lucide-react";

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
  logo_url?: string;
  response_length?: "short" | "medium" | "long";
};

const ProjectSettings = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [aiCharacter, setAiCharacter] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0ea5e9");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [targetUrls, setTargetUrls] = useState<string[]>([]);
  const [responseLength, setResponseLength] = useState<"short" | "medium" | "long">("medium");
  const [logoUrl, setLogoUrl] = useState<string>("");

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
      setResponseLength(p.response_length || "medium");
      setLogoUrl(p.logo_url || "");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchProject();
    }
  }, [user, projectId]);

  const handleSave = async () => {
    if (!project || !user) return;
    
    setSaving(true);
    
    const { error } = await supabase
      .from("projects")
      .update({
        name,
        description,
        target_urls: targetUrls,
        ai_character: aiCharacter,
        primary_color: primaryColor,
        welcome_message: welcomeMessage,
        is_active: isActive,
        response_length: responseLength,
        logo_url: logoUrl,
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // ファイルサイズチェック (5MBまで)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "エラー", description: "画像サイズは5MB以下にしてください", variant: "destructive" });
      return;
    }
    
    // Supabase Storageにアップロード
    const fileExt = file.name.split('.').pop();
    const fileName = `${projectId}/logo.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('project-logos')
      .upload(fileName, file);
    
    if (error) {
      toast({ title: "アップロードエラー", description: error.message, variant: "destructive" });
      return;
    }
    
    // 公開URLを取得
    const { data: { publicUrl } } = supabase.storage
      .from('project-logos')
      .getPublicUrl(fileName);
    
    setLogoUrl(publicUrl);
    toast({ title: "ロゴをアップロードしました" });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
            {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : null}
            <Save className="mr-2 h-4 w-4" />
            保存
          </Button>
        </div>
      </header>

      <main className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              基本設定
            </CardTitle>
            <CardDescription>チャットボットの基本設定を管理</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>プロジェクト名</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>テーマカラー</Label>
                <div className="flex items-center gap-3">
                  <Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-16 p-1" />
                  <span className="text-sm text-muted-foreground font-mono">{primaryColor}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>説明</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            
            <div className="space-y-2">
              <Label>ウェルカムメッセージ</Label>
              <Input value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} />
            </div>
            
            <div className="space-y-2">
              <Label>AIキャラクター</Label>
              <Textarea 
                value={aiCharacter} 
                onChange={(e) => setAiCharacter(e.target.value)} 
                placeholder="例: あなたは親切で丁寧なAIアシスタントです。"
                rows={4}
              />
            </div>
            
            <div className="space-y-2">
              <Label>ロゴ画像</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="flex-1"
                />
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="ロゴ"
                    className="h-10 w-10 object-contain rounded"
                  />
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>チャットボットを有効化</Label>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ProjectSettings;
