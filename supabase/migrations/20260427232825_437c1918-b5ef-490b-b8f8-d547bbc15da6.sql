
-- Support conversations between a company and the master admin team
CREATE TABLE public.support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  subject text,
  status text NOT NULL DEFAULT 'open', -- 'open' | 'closed'
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  unread_for_company integer NOT NULL DEFAULT 0,
  unread_for_admin integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_conversations_company ON public.support_conversations(company_id);
CREATE INDEX idx_support_conversations_last ON public.support_conversations(last_message_at DESC);

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  sender_user_id uuid,
  sender_role text NOT NULL, -- 'company' | 'admin'
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_messages_conv ON public.support_messages(conversation_id, created_at);

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Conversations policies
CREATE POLICY "Admins manage all support conversations"
  ON public.support_conversations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members view their company conversations"
  ON public.support_conversations FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Company admins create conversations"
  ON public.support_conversations FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'company_admin')
    AND created_by = auth.uid()
  );

CREATE POLICY "Company admins update their conversations"
  ON public.support_conversations FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'company_admin')
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'company_admin')
  );

-- Messages policies
CREATE POLICY "Admins manage all support messages"
  ON public.support_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members view their company messages"
  ON public.support_messages FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Company admins send messages"
  ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'company_admin')
    AND sender_user_id = auth.uid()
    AND sender_role = 'company'
  );

-- Trigger: keep conversation summary fresh + bump unread counters
CREATE OR REPLACE FUNCTION public.touch_support_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_conversations
    SET last_message_at = NEW.created_at,
        last_message_preview = LEFT(NEW.body, 140),
        unread_for_admin   = CASE WHEN NEW.sender_role = 'company' THEN unread_for_admin + 1 ELSE unread_for_admin END,
        unread_for_company = CASE WHEN NEW.sender_role = 'admin'   THEN unread_for_company + 1 ELSE unread_for_company END,
        status = 'open',
        updated_at = now()
    WHERE id = NEW.conversation_id;

  -- Notify the company when admin replies
  IF NEW.sender_role = 'admin' THEN
    INSERT INTO public.notifications (company_id, type, title, body, link, metadata)
    VALUES (
      NEW.company_id, 'lead',
      'New reply from Support',
      LEFT(NEW.body, 140),
      '/support',
      jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_support_conv
AFTER INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_support_conversation();

CREATE TRIGGER update_support_conversations_updated_at
BEFORE UPDATE ON public.support_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
ALTER TABLE public.support_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;
