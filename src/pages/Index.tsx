import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Bot, ArrowRight, Globe, Sparkles, Code } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const handleStart = () => {
    navigate(user ? "/dashboard" : "/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">AI Chatbot Manager</span>
          </div>
          <Button onClick={handleStart} variant="default" size="sm">
            {user ? "ダッシュボード" : "ログイン"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="container py-24 text-center">
          <div className="mx-auto max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              AIチャットボット管理プラットフォーム
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Webサイトの情報を活用した
              <br />
              <span className="text-primary">AIチャットボット</span>を簡単構築
            </h1>
            <p className="text-lg text-muted-foreground">
              対象WebサイトのURLを登録するだけで、AIが自動で情報を学習。
              お客様対応を24時間自動化します。
            </p>
            <Button size="lg" onClick={handleStart}>
              無料で始める
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/30 py-20">
          <div className="container">
            <div className="grid gap-8 md:grid-cols-3">
              <div className="rounded-xl border bg-card p-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">Webサイト自動学習</h3>
                <p className="text-sm text-muted-foreground">
                  URLを登録するだけでAIがサイト内容をクローリング・学習。常に最新情報で回答します。
                </p>
              </div>
              <div className="rounded-xl border bg-card p-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">カスタマイズ可能なAI</h3>
                <p className="text-sm text-muted-foreground">
                  AIのキャラクター設定やトーン、デザインカラーを自由にカスタマイズ。
                </p>
              </div>
              <div className="rounded-xl border bg-card p-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Code className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">簡単埋め込み</h3>
                <p className="text-sm text-muted-foreground">
                  生成されたコードをコピー＆ペーストするだけで、任意のWebサイトに埋め込めます。
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>© 2026 AI Chatbot Manager. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Index;
