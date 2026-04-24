-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
CREATE TYPE public.notification_type AS ENUM (
  'lead', 'booking', 'missed', 'review', 'summary', 'sms', 'note', 'system'
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NULL, -- optional: target a specific user; null = whole company
  type public.notification_type NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_company_created
  ON public.notifications (company_id, created_at DESC);
CREATE INDEX idx_notifications_unread
  ON public.notifications (company_id, read) WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view their company notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY "Company admins update their notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Company admins delete their notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins manage all notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- NOTIFICATION PREFERENCES TABLE
-- ============================================================
CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY,
  push boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT true,
  daily_summary boolean NOT NULL DEFAULT true,
  missed_call boolean NOT NULL DEFAULT true,
  new_review boolean NOT NULL DEFAULT false,
  new_lead boolean NOT NULL DEFAULT true,
  new_sms boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own prefs"
  ON public.notification_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own prefs"
  ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own prefs"
  ON public.notification_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own prefs"
  ON public.notification_preferences FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TRIGGER: notify on new call
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_new_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _type public.notification_type;
  _title text;
  _body text;
BEGIN
  IF NEW.status = 'missed' THEN
    _type := 'missed';
    _title := 'Missed call';
    _body := COALESCE(NEW.caller, NEW.phone, 'Unknown caller') || ' — AI could not reach the caller';
  ELSE
    _type := 'lead';
    _title := 'New call handled';
    _body := COALESCE(NEW.summary,
             COALESCE(NEW.caller, NEW.phone, 'Unknown caller') || ' • ' || NEW.duration_sec || 's');
  END IF;

  INSERT INTO public.notifications (company_id, type, title, body, link, metadata)
  VALUES (
    NEW.company_id, _type, _title, _body,
    '/calls/' || NEW.id::text,
    jsonb_build_object('call_id', NEW.id, 'phone', NEW.phone)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_new_call
  AFTER INSERT ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_call();

-- ============================================================
-- TRIGGER: notify on inbound SMS
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_new_sms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _customer text;
BEGIN
  IF NEW.direction <> 'inbound' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(customer, phone) INTO _customer
  FROM public.sms_threads WHERE id = NEW.thread_id;

  INSERT INTO public.notifications (company_id, type, title, body, link, metadata)
  VALUES (
    NEW.company_id, 'sms',
    'New message from ' || COALESCE(_customer, 'customer'),
    LEFT(NEW.body, 140),
    '/sms',
    jsonb_build_object('thread_id', NEW.thread_id, 'message_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_new_sms
  AFTER INSERT ON public.sms_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_sms();

-- ============================================================
-- TRIGGER: notify on new note
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_new_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (company_id, type, title, body, link, metadata)
  VALUES (
    NEW.company_id, 'note',
    'New note: ' || NEW.title,
    LEFT(COALESCE(NEW.body, ''), 140),
    '/notes',
    jsonb_build_object('note_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_new_note
  AFTER INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_note();

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;