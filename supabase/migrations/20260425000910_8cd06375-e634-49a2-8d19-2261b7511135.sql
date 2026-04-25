
DROP TRIGGER IF EXISTS trg_notify_on_new_call ON public.calls;
CREATE TRIGGER trg_notify_on_new_call
  AFTER INSERT ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_call();

DROP TRIGGER IF EXISTS trg_notify_on_new_sms ON public.sms_messages;
CREATE TRIGGER trg_notify_on_new_sms
  AFTER INSERT ON public.sms_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_sms();

DROP TRIGGER IF EXISTS trg_notify_on_new_note ON public.notes;
CREATE TRIGGER trg_notify_on_new_note
  AFTER INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_note();
