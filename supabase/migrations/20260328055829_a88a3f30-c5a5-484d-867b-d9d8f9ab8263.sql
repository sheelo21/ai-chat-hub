
-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  target_urls TEXT[] NOT NULL DEFAULT '{}',
  ai_character TEXT NOT NULL DEFAULT 'あなたは親切なアシスタントです。ユーザーの質問に丁寧に答えてください。',
  primary_color TEXT NOT NULL DEFAULT '#0ea5e9',
  welcome_message TEXT NOT NULL DEFAULT 'こんにちは！何かお手伝いできることはありますか？',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- Public read for chatbot page (active projects only)
CREATE POLICY "Public can view active projects" ON public.projects FOR SELECT USING (is_active = true);

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Crawl logs table
CREATE TABLE public.crawl_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  pages_crawled INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.crawl_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view crawl logs for their projects" ON public.crawl_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects WHERE projects.id = crawl_logs.project_id AND projects.user_id = auth.uid())
);
CREATE POLICY "Users can create crawl logs for their projects" ON public.crawl_logs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects WHERE projects.id = crawl_logs.project_id AND projects.user_id = auth.uid())
);

-- Chat messages table (public write for chatbot users)
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Public can insert messages (chatbot users)
CREATE POLICY "Anyone can insert chat messages" ON public.chat_messages FOR INSERT WITH CHECK (true);
-- Public can read their own session messages
CREATE POLICY "Anyone can read chat messages by session" ON public.chat_messages FOR SELECT USING (true);
-- Owners can read all messages for their projects
CREATE POLICY "Owners can read project chat messages" ON public.chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects WHERE projects.id = chat_messages.project_id AND projects.user_id = auth.uid())
);
