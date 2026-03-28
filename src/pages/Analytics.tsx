import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, TrendingUp, Users, Calendar, Clock, BarChart3, PieChart, ThumbsUp, ThumbsDown } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ja } from "date-fns/locale";

type ChatMessage = {
  id: string;
  content: string;
  role: string;
  session_id: string;
  created_at: string;
  feedback?: "up" | "down" | null;
};

type DailyStats = {
  date: string;
  totalMessages: number;
  uniqueSessions: number;
  userMessages: number;
  assistantMessages: number;
};

type KeywordData = {
  keyword: string;
  count: number;
};

type SessionData = {
  session_id: string;
  message_count: number;
  first_message: string;
  created_at: string;
};

const Analytics = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [topKeywords, setTopKeywords] = useState<KeywordData[]>([]);
  const [recentSessions, setRecentSessions] = useState<SessionData[]>([]);
  const [period, setPeriod] = useState("7");

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
    setProject(data);
  };

  const fetchMessages = async () => {
    if (!projectId) return;
    
    const startDate = startOfDay(subDays(new Date(), parseInt(period)));
    const endDate = endOfDay(new Date());
    
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("project_id", projectId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: true });

    if (data) {
      setMessages(data as ChatMessage[]);
      calculateStats(data as ChatMessage[]);
    }
  };

  const calculateStats = (msgs: ChatMessage[]) => {
    // 日次統計
    const stats: { [key: string]: DailyStats } = {};
    
    msgs.forEach(msg => {
      const date = format(new Date(msg.created_at), "yyyy-MM-dd");
      if (!stats[date]) {
        stats[date] = {
          date,
          totalMessages: 0,
          uniqueSessions: new Set<string>(),
          userMessages: 0,
          assistantMessages: 0,
        } as any;
      }
      
      stats[date].totalMessages++;
      (stats[date].uniqueSessions as Set<string>).add(msg.session_id);
      
      if (msg.role === "user") {
        stats[date].userMessages++;
      } else {
        stats[date].assistantMessages++;
      }
    });
    
    setDailyStats(Object.values(stats).map(stat => ({
      ...stat,
      uniqueSessions: (stat.uniqueSessions as Set<string>).size,
    })).sort((a, b) => a.date.localeCompare(b.date)));

    // キーワード分析
    const userMessages = msgs.filter(msg => msg.role === "user");
    const keywordCount: { [key: string]: number } = {};
    
    userMessages.forEach(msg => {
      const words = msg.content
        .toLowerCase()
        .replace(/[^\w\s\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, "")
        .split(/\s+/)
        .filter(word => word.length > 1);
      
      words.forEach(word => {
        keywordCount[word] = (keywordCount[word] || 0) + 1;
      });
    });
    
    setTopKeywords(
      Object.entries(keywordCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20)
        .map(([keyword, count]) => ({ keyword, count }))
    );

    // セッション分析
    const sessionMap: { [key: string]: SessionData } = {};
    msgs.forEach(msg => {
      if (!sessionMap[msg.session_id]) {
        sessionMap[msg.session_id] = {
          session_id: msg.session_id,
          message_count: 0,
          first_message: msg.content,
          created_at: msg.created_at,
        };
      }
      sessionMap[msg.session_id].message_count++;
    });
    
    setRecentSessions(
      Object.values(sessionMap)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)
    );
  };

  useEffect(() => {
    if (user) {
      fetchProject();
      fetchMessages();
    }
  }, [user, projectId, period]);

  useEffect(() => {
    if (messages.length > 0) {
      calculateStats(messages);
    }
  }, [messages]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const totalMessages = messages.length;
  const totalSessions = new Set(messages.map(m => m.session_id)).size;
  const avgMessagesPerSession = totalSessions > 0 ? (totalMessages / totalSessions).toFixed(1) : "0";

  const thumbsUp = messages.filter(msg => msg.role === "assistant" && msg.feedback === "up").length;
  const thumbsDown = messages.filter(msg => msg.role === "assistant" && msg.feedback === "down").length;
  const totalFeedback = thumbsUp + thumbsDown;
  const positiveRate = totalFeedback > 0 ? Math.round((thumbsUp / totalFeedback) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/project/${projectId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{project?.name} - 分析</h1>
          </div>
          <div className="flex gap-2">
            {(["7", "30", "90"] as const).map(days => (
              <Button
                key={days}
                variant={period === days ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod(days)}
              >
                {days}日
              </Button>
            ))}
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="grid gap-6 mb-6 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">総メッセージ数</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalMessages}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">総セッション数</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSessions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均メッセージ数</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgMessagesPerSession}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">満足度</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{positiveRate}%</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="daily" className="space-y-6">
          <TabsList>
            <TabsTrigger value="daily">📅 日次統計</TabsTrigger>
            <TabsTrigger value="keywords">🔤 キーワード</TabsTrigger>
            <TabsTrigger value="sessions">💬 セッション</TabsTrigger>
            <TabsTrigger value="feedback">👍 フィードバック</TabsTrigger>
          </TabsList>

          <TabsContent value="daily">
            <Card>
              <CardHeader>
                <CardTitle>日次統計</CardTitle>
                <CardDescription>メッセージ数とセッション数の推移</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dailyStats.map((stat, index) => (
                    <div key={stat.date} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{format(new Date(stat.date), "MM/dd")}</p>
                          <p className="text-xs text-muted-foreground">
                            {stat.userMessages + stat.assistantMessages}メッセージ
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{stat.totalMessages}</p>
                        <p className="text-sm text-muted-foreground">{stat.uniqueSessions} セッション</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="keywords">
            <Card>
              <CardHeader>
                <CardTitle>頻出キーワード</CardTitle>
                <CardDescription>ユーザーがよく使う言葉トップ20</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topKeywords.map((item, index) => (
                    <div key={item.keyword} className="flex items-center justify-between p-2 rounded">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="w-8 h-8 flex items-center justify-center">
                          {index + 1}
                        </Badge>
                        <span className="font-medium">{item.keyword}</span>
                      </div>
                      <Badge variant="outline">{item.count} 回</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions">
            <Card>
              <CardHeader>
                <CardTitle>最近のセッション</CardTitle>
                <CardDescription>最新のチャットセッション詳細</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentSessions.map(sessionData => (
                    <div key={sessionData.session_id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-sm">セッションID: {sessionData.session_id.slice(0, 8)}...</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(sessionData.created_at), "yyyy/MM/dd HH:mm")}
                          </p>
                        </div>
                        <Badge variant="outline">{sessionData.message_count} メッセージ</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        最初の質問: {sessionData.first_message}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="feedback">
            <Card>
              <CardHeader>
                <CardTitle>フィードバック分析</CardTitle>
                <CardDescription>ユーザーからの評価フィードバック</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-4">
                    <h4 className="font-medium">評価統計</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between p-3 bg-green-50 rounded">
                        <span className="text-green-700 flex items-center gap-2">
                          <ThumbsUp className="h-4 w-4" />
                          いいね
                        </span>
                        <span className="font-bold text-green-700">{thumbsUp}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-red-50 rounded">
                        <span className="text-red-700 flex items-center gap-2">
                          <ThumbsDown className="h-4 w-4" />
                          バッド
                        </span>
                        <span className="font-bold text-red-700">{thumbsDown}</span>
                      </div>
                      <div className="flex justify-between p-3 bg-blue-50 rounded">
                        <span className="text-blue-700">満足度</span>
                        <span className="font-bold text-blue-700">{positiveRate}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium">フィードバック付きメッセージ</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {messages
                        .filter(msg => msg.role === "assistant" && msg.feedback)
                        .map(msg => (
                          <div key={msg.id} className="p-3 border rounded">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={msg.feedback === "up" ? "default" : "destructive"}>
                                {msg.feedback === "up" ? "👍" : "👎"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(msg.created_at), "MM/dd HH:mm")}
                              </span>
                            </div>
                            <p className="text-sm line-clamp-3">{msg.content}</p>
                          </div>
                        ))}
                      {messages.filter(msg => msg.role === "assistant" && msg.feedback).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          フィードバックがまだありません
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Analytics;
