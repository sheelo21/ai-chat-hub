import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Bot, Send, RefreshCw, User } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ProjectInfo = {
  id: string;
  name: string;
  primary_color: string;
  welcome_message: string;
  ai_character: string;
  is_active: boolean;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatbot-respond`;

const ChatBot = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { toast } = useToast();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchProject = async () => {
      if (!projectId) return;
      const { data } = await supabase
        .from("projects")
        .select("id, name, primary_color, welcome_message, ai_character, is_active")
        .eq("id", projectId)
        .eq("is_active", true)
        .single();
      setProject(data as ProjectInfo | null);
      setLoading(false);
    };
    fetchProject();
  }, [projectId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !projectId || sending) return;
    const userMsg = input.trim();
    setInput("");
    setSending(true);

    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: userMsg };
    setMessages((prev) => [...prev, userMessage]);

    // Save user message to DB
    supabase.from("chat_messages").insert({
      project_id: projectId,
      session_id: sessionId,
      role: "user",
      content: userMsg,
    }).then(() => {});

    // Build conversation history for AI
    const chatHistory = [...messages, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: chatHistory, projectId }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: "AI応答エラー" }));
        toast({ title: "エラー", description: errData.error || `エラー (${resp.status})`, variant: "destructive" });
        setSending(false);
        return;
      }

      if (!resp.body) {
        toast({ title: "エラー", description: "ストリーミングがサポートされていません", variant: "destructive" });
        setSending(false);
        return;
      }

      // Stream response
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";
      const assistantId = crypto.randomUUID();

      // Add empty assistant message
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              const currentContent = assistantContent;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: currentContent } : m))
              );
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              const currentContent = assistantContent;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: currentContent } : m))
              );
            }
          } catch { /* ignore */ }
        }
      }

      // Save assistant message to DB
      if (assistantContent) {
        supabase.from("chat_messages").insert({
          project_id: projectId,
          session_id: sessionId,
          role: "assistant",
          content: assistantContent,
        }).then(() => {});
      }
    } catch (e) {
      console.error("Stream error:", e);
      toast({ title: "エラー", description: "AI応答の取得に失敗しました", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Bot className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">このチャットボットは現在利用できません</p>
        </div>
      </div>
    );
  }

  const themeColor = project.primary_color;

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderBottomColor: themeColor + "30" }}>
        <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: themeColor }}>
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold">{project.name}</p>
          <p className="text-xs text-muted-foreground">オンライン</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-4 max-w-xl mx-auto">
          {/* Welcome message */}
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: themeColor }}>
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-chat-bot px-4 py-2.5">
              <p className="text-sm text-chat-bot-foreground">{project.welcome_message}</p>
            </div>
          </div>

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              {msg.role === "assistant" ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: themeColor }}>
                  <Bot className="h-4 w-4 text-white" />
                </div>
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div
                className={`rounded-2xl px-4 py-2.5 max-w-[80%] ${
                  msg.role === "user"
                    ? "rounded-tr-sm text-white"
                    : "rounded-tl-sm bg-chat-bot text-chat-bot-foreground"
                }`}
                style={msg.role === "user" ? { backgroundColor: themeColor } : undefined}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {sending && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: themeColor }}>
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-chat-bot px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="mx-auto flex max-w-xl gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力..."
            disabled={sending}
            className="flex-1"
          />
          <Button type="submit" disabled={sending || !input.trim()} size="icon" style={{ backgroundColor: themeColor }}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatBot;
