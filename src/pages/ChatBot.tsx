import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Bot, Send, RefreshCw, User, Mic, MicOff, Volume2, ThumbsUp, ThumbsDown, Copy, RotateCcw, X } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  feedback?: "up" | "down";
};

type ProjectInfo = {
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
  const inputRef = useRef<HTMLInputElement>(null);
  
  // UI改善状態
  const [isRecording, setIsRecording] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // タイピング検出
  useEffect(() => {
    const typingTimer = setTimeout(() => {
      setIsTyping(false);
    }, 1000);

    if (input.length > 0) {
      setIsTyping(true);
    }

    return () => clearTimeout(typingTimer);
  }, [input]);

  // 文字数カウント
  useEffect(() => {
    setCharCount(input.length);
  }, [input]);

  const handleSend = async () => {
    if (!input.trim() || !projectId || sending) return;
    const userMsg = input.trim();
    setInput("");
    setSending(true);
    setCharCount(0);

    const userMessage: Message = { 
      id: crypto.randomUUID(), 
      role: "user", 
      content: userMsg,
      timestamp: new Date().toISOString()
    };
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
      setMessages((prev) => [...prev, { 
        id: assistantId, 
        role: "assistant", 
        content: "",
        timestamp: new Date().toISOString()
      }]);

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

  // UI改善機能
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [input, sending]);

  const handleCopyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "コピーしました" });
  }, []);

  const handleFeedback = useCallback((messageId: string, feedback: "up" | "down") => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, feedback } : msg
    ));
    toast({ title: feedback === "up" ? "高く評価しました" : "低く評価しました" });
    
    // フィードバックデータをDBに保存
    if (projectId) {
      supabase
        .from("chat_messages")
        .update({ feedback })
        .eq("id", messageId)
        .then(() => {});
    }
  }, [projectId]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    toast({ title: "チャットをクリアしました" });
  }, []);

  const handleVoiceInput = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({ title: "音声認識に対応していません", variant: "destructive" });
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'ja-JP';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
      toast({ title: "音声認識を開始しました" });
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsRecording(false);
      toast({ title: "音声認識が完了しました" });
    };

    recognition.onerror = () => {
      setIsRecording(false);
      toast({ title: "音声認識に失敗しました", variant: "destructive" });
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  }, []);

  const handleTextToSpeech = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      toast({ title: "音声読み上げに対応していません", variant: "destructive" });
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
  }, []);

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
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderBottomColor: themeColor + "30" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: themeColor }}>
            {project.logo_url ? (
              <img src={project.logo_url} alt="ロゴ" className="h-5 w-5 object-contain" />
            ) : (
              <Bot className="h-5 w-5 text-white" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">{project.name}</p>
            <p className="text-xs text-muted-foreground">
              {isTyping ? "入力中..." : "オンライン"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearChat}
            className="h-8 w-8"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.close()}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
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
              <div className="group relative max-w-[80%]">
                <div
                  className={`rounded-2xl px-4 py-2.5 ${
                    msg.role === "user"
                      ? "rounded-tr-sm text-white"
                      : "rounded-tl-sm bg-chat-bot text-chat-bot-foreground"
                  }`}
                  style={msg.role === "user" ? { backgroundColor: themeColor } : undefined}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
                
                {/* メッセージアクションボタン */}
                <div className={`absolute ${msg.role === "user" ? "left-0 -ml-20" : "right-0 -mr-20"} top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1`}>
                  {msg.role === "assistant" && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleCopyMessage(msg.content)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleTextToSpeech(msg.content)}
                      >
                        <Volume2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 ${msg.feedback === "up" ? "text-green-600" : ""}`}
                        onClick={() => handleFeedback(msg.id, "up")}
                      >
                        <ThumbsUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 ${msg.feedback === "down" ? "text-red-600" : ""}`}
                        onClick={() => handleFeedback(msg.id, "down")}
                      >
                        <ThumbsDown className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
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
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージを入力... (Shift+Enterで改行)"
              disabled={sending}
              className="flex-1 pr-20"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span className="text-xs text-muted-foreground">
                {charCount > 0 && `${charCount}文字`}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleVoiceInput}
                disabled={sending || isRecording}
              >
                {isRecording ? <MicOff className="h-3 w-3 text-red-500" /> : <Mic className="h-3 w-3" />}
              </Button>
            </div>
          </div>
          <Button type="submit" disabled={sending || !input.trim()} size="icon" style={{ backgroundColor: themeColor }}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        
        {/* ヒント */}
        <div className="mx-auto mt-2 max-w-xl">
          <p className="text-xs text-muted-foreground text-center">
            💡 ヒント: Enterで送信、Shift+Enterで改行、🎤音声入力も利用できます
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;
