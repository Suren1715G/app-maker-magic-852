import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Star, RefreshCw, Plug, Unplug, MessageSquareReply, Trash2, Building2, Check } from "lucide-react";
import { fmtRel } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CompanyRow {
  id: string;
  google_business_account_id: string | null;
  google_business_location_id: string | null;
  google_business_location_name: string | null;
  google_business_owner_user_id: string | null;
}

interface ReviewRow {
  id: string;
  google_review_id: string | null;
  reviewer_name: string | null;
  reviewer_photo_url: string | null;
  rating: number;
  comment: string | null;
  reply_text: string | null;
  reply_updated_at: string | null;
  posted_at: string;
}

interface LocationOption {
  account: { name: string; accountName?: string };
  locations: Array<{ name: string; title?: string; storefrontAddress?: any }>;
}

export function GoogleReviewsPanel({
  companyId,
  canManage,
}: {
  companyId: string;
  canManage: boolean;
}) {
  const [company, setCompany] = useState<CompanyRow | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<LocationOption[] | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});

  const loadAll = async () => {
    setLoading(true);
    const [{ data: comp }, { data: revs }] = await Promise.all([
      supabase
        .from("companies")
        .select(
          "id, google_business_account_id, google_business_location_id, google_business_location_name, google_business_owner_user_id",
        )
        .eq("id", companyId)
        .maybeSingle(),
      supabase
        .from("reviews")
        .select(
          "id, google_review_id, reviewer_name, reviewer_photo_url, rating, comment, reply_text, reply_updated_at, posted_at",
        )
        .eq("company_id", companyId)
        .order("posted_at", { ascending: false })
        .limit(100),
    ]);
    setCompany(comp as CompanyRow);
    setReviews((revs as ReviewRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [companyId]);

  const callApi = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("google-business-reviews", {
      body: { action, company_id: companyId, ...extra },
    });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error((data as any).error);
    return data;
  };

  const handleConnect = async () => {
    setBusy(true);
    try {
      // Reuse the existing google-oauth-start flow; on return, the token will
      // include business.manage scope so we can list locations.
      const { data, error } = await supabase.functions.invoke("google-oauth-start", {
        body: {},
      });
      if (error) throw new Error(error.message);
      const url = (data as any)?.url;
      if (!url) throw new Error("No auth URL returned");
      window.location.href = url;
    } catch (e: any) {
      toast.error(e.message);
      setBusy(false);
    }
  };

  const handleListLocations = async () => {
    setBusy(true);
    try {
      const data = await callApi("list_locations");
      setPicker((data as any).accounts ?? []);
      if (!((data as any).accounts ?? []).length) {
        toast.message("No Google Business accounts found for this Google login.");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePick = async (accountName: string, locationName: string, displayName: string) => {
    setBusy(true);
    try {
      await callApi("set_location", {
        account_name: accountName,
        location_name: locationName,
        display_name: displayName,
      });
      toast.success("Linked.");
      setPicker(null);
      await loadAll();
      await handleSync();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async () => {
    setBusy(true);
    try {
      const data = await callApi("sync");
      toast.success(`Synced ${(data as any).synced ?? 0} reviews.`);
      await loadAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect this company's Google Business link?")) return;
    setBusy(true);
    try {
      await callApi("disconnect");
      toast.success("Disconnected.");
      await loadAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReply = async (reviewId: string) => {
    const text = replyDraft[reviewId]?.trim();
    if (!text) return;
    setBusy(true);
    try {
      await callApi("reply", { review_id: reviewId, text });
      toast.success("Reply posted.");
      setReplyDraft((d) => ({ ...d, [reviewId]: "" }));
      await loadAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteReply = async (reviewId: string) => {
    if (!confirm("Delete this reply on Google?")) return;
    setBusy(true);
    try {
      await callApi("delete_reply", { review_id: reviewId });
      toast.success("Reply removed.");
      await loadAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="glass rounded-2xl p-6 text-sm text-muted-foreground">Loading…</div>;
  }

  const linked = !!company?.google_business_location_id;
  const avg = reviews.length
    ? reviews.reduce((a, b) => a + (b.rating || 0), 0) / reviews.length
    : 0;

  return (
    <div className="space-y-5">
      {/* Connection card */}
      <div className="glass rounded-2xl p-5">
        {!linked && !picker && (
          <div className="text-center">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-display font-semibold mb-1">Connect Google Business</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Connect your Google account to pull live reviews and reply directly from here.
            </p>
            {canManage && (
              <div className="flex gap-2 justify-center">
                <Button onClick={handleConnect} disabled={busy} className="gap-2">
                  <Plug className="h-4 w-4" /> Connect Google
                </Button>
                <Button onClick={handleListLocations} disabled={busy} variant="outline" className="gap-2">
                  Already connected? Pick a location
                </Button>
              </div>
            )}
          </div>
        )}

        {!linked && picker && (
          <div>
            <h3 className="font-display font-semibold mb-3">Pick a business location</h3>
            {picker.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Business Profile accounts found on this Google login.</p>
            ) : (
              <ul className="space-y-2">
                {picker.flatMap((a) =>
                  (a.locations ?? []).map((loc) => (
                    <li key={loc.name} className="flex items-center justify-between bg-card rounded-xl p-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{loc.title ?? loc.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{a.account.name}</div>
                      </div>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => handlePick(a.account.name, loc.name, loc.title ?? loc.name)}
                      >
                        <Check className="h-3.5 w-3.5" /> Use
                      </Button>
                    </li>
                  )),
                )}
              </ul>
            )}
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setPicker(null)}>
              Cancel
            </Button>
          </div>
        )}

        {linked && (
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Linked location</div>
              <div className="font-display text-lg font-semibold mt-0.5">
                {company?.google_business_location_name ?? "Google Business"}
              </div>
              <div className="flex items-baseline gap-3 mt-2">
                <span className="font-display text-3xl font-semibold">
                  {reviews.length ? avg.toFixed(1) : "—"}
                </span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={cn(
                        "h-4 w-4",
                        n <= Math.round(avg) ? "fill-accent text-accent" : "text-muted",
                      )}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {reviews.length} review{reviews.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            {canManage && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleSync} disabled={busy} className="gap-1.5">
                  <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} /> Sync
                </Button>
                <Button size="sm" variant="outline" onClick={handleListLocations} disabled={busy}>
                  Change location
                </Button>
                <Button size="sm" variant="outline" onClick={handleDisconnect} disabled={busy} className="gap-1.5">
                  <Unplug className="h-4 w-4" /> Disconnect
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reviews list */}
      {linked && (
        <div>
          <h2 className="font-display text-lg font-semibold mb-3">Reviews</h2>
          {reviews.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
              No reviews yet. Hit Sync to pull from Google.
            </div>
          ) : (
            <ul className="space-y-2">
              {reviews.map((r) => (
                <li key={r.id} className="glass rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {r.reviewer_photo_url && (
                        <img
                          src={r.reviewer_photo_url}
                          alt=""
                          className="h-7 w-7 rounded-full object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="font-medium truncate">{r.reviewer_name ?? "Anonymous"}</div>
                    </div>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={cn(
                            "h-3.5 w-3.5",
                            n <= r.rating ? "fill-accent text-accent" : "text-muted",
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  {r.comment && <p className="text-sm text-foreground/80 whitespace-pre-wrap">{r.comment}</p>}
                  <div className="text-[11px] text-muted-foreground mt-2">
                    Google · {fmtRel(r.posted_at)}
                  </div>

                  {/* Reply block */}
                  <div className="mt-3 border-t border-border pt-3">
                    {r.reply_text ? (
                      <div className="bg-card rounded-xl p-3">
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                          Owner reply
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{r.reply_text}</p>
                        {canManage && (
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setReplyDraft((d) => ({ ...d, [r.id]: r.reply_text ?? "" }))
                              }
                            >
                              <MessageSquareReply className="h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteReply(r.id)}
                              disabled={busy}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {canManage && replyDraft[r.id] !== undefined && (
                      <div className="mt-2 space-y-2">
                        <Textarea
                          rows={2}
                          placeholder="Write a reply…"
                          value={replyDraft[r.id]}
                          onChange={(e) =>
                            setReplyDraft((d) => ({ ...d, [r.id]: e.target.value }))
                          }
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleReply(r.id)} disabled={busy}>
                            Post reply
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setReplyDraft((d) => {
                                const next = { ...d };
                                delete next[r.id];
                                return next;
                              })
                            }
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {canManage && !r.reply_text && replyDraft[r.id] === undefined && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReplyDraft((d) => ({ ...d, [r.id]: "" }))}
                        className="gap-1.5"
                      >
                        <MessageSquareReply className="h-3.5 w-3.5" /> Reply
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}