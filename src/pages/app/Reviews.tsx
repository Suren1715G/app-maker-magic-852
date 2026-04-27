import { AppShell, PageHeader } from "@/components/app/AppShell";
import { Star, RefreshCw, Plug, Unplug, MessageSquareReply } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { GoogleReviewsPanel } from "@/components/app/GoogleReviewsPanel";

const Reviews = () => {
  const { user, companyId } = useAuth();
  if (!user || !companyId) {
    return (
      <AppShell>
        <PageHeader title="Reviews" subtitle="Google reviews for your business." />
        <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      </AppShell>
    );
  }
  return (
    <AppShell>
      <PageHeader title="Reviews" subtitle="Live from your Google Business Profile." />
      <GoogleReviewsPanel companyId={companyId} canManage={true} />
    </AppShell>
  );
};

export { Reviews };
export default Reviews;