-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('admin', 'client');

-- Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create agents table
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'voiceflow' or 'retell'
  api_key TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create agent_assignments table (links agents to clients)
CREATE TABLE public.agent_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_id, client_id)
);

-- Create client_users table (links users to clients)
CREATE TABLE public.client_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);

-- Create conversations table
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  caller_phone TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'handover_requested'
  sentiment TEXT, -- 'positive', 'neutral', 'negative'
  duration INTEGER, -- in seconds
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create transcripts table
CREATE TABLE public.transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL, -- 'agent' or 'caller'
  text TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confidence NUMERIC(3,2)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'admin'
  );
$$;

-- Create function to get user's client IDs
CREATE OR REPLACE FUNCTION public.get_user_client_ids(user_id UUID)
RETURNS TABLE(client_id UUID)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cu.client_id
  FROM public.client_users cu
  WHERE cu.user_id = user_id;
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

-- RLS Policies for clients
CREATE POLICY "Admins can do everything with clients"
  ON public.clients FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Client users can view their clients"
  ON public.clients FOR SELECT
  USING (
    id IN (SELECT * FROM public.get_user_client_ids(auth.uid()))
  );

-- RLS Policies for agents
CREATE POLICY "Admins can do everything with agents"
  ON public.agents FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Client users can view assigned agents"
  ON public.agents FOR SELECT
  USING (
    id IN (
      SELECT aa.agent_id 
      FROM public.agent_assignments aa
      WHERE aa.client_id IN (SELECT * FROM public.get_user_client_ids(auth.uid()))
    )
  );

-- RLS Policies for agent_assignments
CREATE POLICY "Admins can manage agent assignments"
  ON public.agent_assignments FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Client users can view their assignments"
  ON public.agent_assignments FOR SELECT
  USING (
    client_id IN (SELECT * FROM public.get_user_client_ids(auth.uid()))
  );

-- RLS Policies for client_users
CREATE POLICY "Admins can manage client users"
  ON public.client_users FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own client associations"
  ON public.client_users FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policies for conversations
CREATE POLICY "Admins can view all conversations"
  ON public.conversations FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Client users can view conversations for their agents"
  ON public.conversations FOR SELECT
  USING (
    agent_id IN (
      SELECT aa.agent_id 
      FROM public.agent_assignments aa
      WHERE aa.client_id IN (SELECT * FROM public.get_user_client_ids(auth.uid()))
    )
  );

-- RLS Policies for transcripts
CREATE POLICY "Admins can view all transcripts"
  ON public.transcripts FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Client users can view transcripts for their conversations"
  ON public.transcripts FOR SELECT
  USING (
    conversation_id IN (
      SELECT c.id 
      FROM public.conversations c
      JOIN public.agent_assignments aa ON aa.agent_id = c.agent_id
      WHERE aa.client_id IN (SELECT * FROM public.get_user_client_ids(auth.uid()))
    )
  );

-- Create trigger for updating profiles timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for conversations
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;