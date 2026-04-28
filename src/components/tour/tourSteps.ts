export type TourStep = {
  /** Path to navigate to before showing this step. */
  route?: string;
  /** CSS selector (usually a data-tour attribute) to spotlight. Optional → centered modal. */
  target?: string;
  title: string;
  body: string;
  /** If true, opens the More sheet before targeting. */
  openMore?: boolean;
};

export const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to your AI receptionist",
    body:
      "We'll walk through every part of your dashboard so you know exactly where everything lives. Heads up — this covers a lot, so it might take a few minutes. You can hit Skip anytime.",
  },

  // ===== HOME =====
  { route: "/", title: "Home", body: "This is your command center — the first thing you see every day." },
  { route: "/", target: '[data-tour="home-status"]', title: "Live status", body: "A real-time pulse showing your AI is online, with today's call count and average duration." },
  { route: "/", target: '[data-tour="home-hours-saved"]', title: "Hours saved", body: "See how much receptionist time the AI saved you this week — tap to dig into the analytics." },
  { route: "/", target: '[data-tour="home-stats"]', title: "Today's stats", body: "Calls, bookings, new leads, and SMS sent — all updated live." },
  { route: "/", target: '[data-tour="home-next-booking"]', title: "Next booking", body: "Your soonest upcoming appointment, pulled straight from the calendar." },
  { route: "/", target: '[data-tour="home-recent-calls"]', title: "Recent calls", body: "The last few calls with quick summaries. Tap any one to see the full transcript." },

  // ===== JARVIS LIVE =====
  { route: "/", target: '[data-tour="jarvis-launcher"]', title: "Talk to Jarvis", body: "This floating button opens a live, hands-free conversation with your AI receptionist. Tap it any time to hear exactly what your callers hear — and try it out yourself." },

  // ===== NAV =====
  { route: "/", target: '[data-tour="bottom-nav"]', title: "Bottom navigation", body: "Your four main sections live here. Tap More for everything else." },
  { route: "/", target: '[data-tour="nav-more"]', title: "More menu", body: "Notes, Analytics, Billing, Referrals, Support and Settings all live behind this button." },

  // ===== CALLS =====
  { route: "/calls", title: "Calls", body: "Every call the AI handled — searchable, taggable, and transcribed." },
  { route: "/calls", target: '[data-tour="calls-stats"]', title: "Call stats", body: "Answered, missed, and total — at a glance." },
  { route: "/calls", target: '[data-tour="calls-filters"]', title: "Quick filters", body: "Filter by status — answered, missed, booked, follow-up needed, and more." },
  { route: "/calls", target: '[data-tour="calls-tags"]', title: "Tags & date range", body: "Narrow further by intent tag or by today / this week / this month." },
  { route: "/calls", target: '[data-tour="calls-list"]', title: "Call list", body: "Tap any call to see the full transcript, recording, AI summary, and any booking it created." },

  // ===== MESSAGES =====
  { route: "/sms", title: "Messages", body: "Two-way SMS conversations the AI is having with your customers." },
  { route: "/sms", target: '[data-tour="sms-threads"]', title: "Threads", body: "Each customer's conversation lives here. Unread badges show what's new — tap in to take over and reply yourself." },

  // ===== CALENDAR =====
  { route: "/calendar", title: "Calendar", body: "Every booking the AI made, synced with your Google Calendar." },
  { route: "/calendar", target: '[data-tour="cal-scope"]', title: "Scope filter", body: "Toggle between all, upcoming, and past bookings." },
  { route: "/calendar", target: '[data-tour="cal-toolbar"]', title: "Navigate & switch views", body: "Jump to today, browse week-to-week, and switch between month, week, and day views." },

  // ===== NOTES =====
  { route: "/notes", title: "Notes & reminders", body: "Capture quick notes for your team — Jarvis can also drop them in for you from a call." },
  { route: "/notes", target: '[data-tour="page-header"]', title: "Add a note", body: "Tap New to add a note, attach a reminder time, and we'll ping you when it's due." },

  // ===== ANALYTICS =====
  { route: "/analytics", title: "Analytics", body: "The numbers behind the AI — calls, bookings, revenue, and trends." },
  { route: "/analytics", target: '[data-tour="analytics-range"]', title: "Time range", body: "Switch between week, month, and quarter views to spot trends." },
  { route: "/analytics", target: '[data-tour="analytics-stats"]', title: "Headline stats", body: "Calls, bookings, revenue, and uptime — your top-line numbers." },
  { route: "/analytics", target: '[data-tour="analytics-volume"]', title: "Call volume", body: "How call traffic is trending day by day." },
  { route: "/analytics", target: '[data-tour="analytics-bookings"]', title: "Bookings & revenue", body: "Visualize what the AI is actually closing for you." },
  { route: "/analytics", target: '[data-tour="analytics-heatmap"]', title: "Best call hours", body: "Heatmap of when calls come in — useful for staffing and follow-up timing." },

  // ===== NOTIFICATIONS =====
  { route: "/notifications", title: "Notifications", body: "All your alerts in one feed — tap any item to jump to it." },
  { route: "/notifications", target: '[data-tour="notif-prefs"]', title: "Preferences", body: "Choose exactly what you want to be notified about — calls, bookings, leads, billing." },

  // ===== AI ANALYST =====
  { route: "/assistant", title: "AI Analyst", body: "Your private business analyst — ask anything about your calls, bookings, or leads." },
  { route: "/assistant", target: '[data-tour="assistant-suggestions"]', title: "Suggested questions", body: "Not sure what to ask? Tap a suggestion to get started." },
  { route: "/assistant", target: '[data-tour="assistant-input"]', title: "Ask anything", body: "Type a question in plain English. The AI knows your data and answers in seconds." },

  // ===== BILLING =====
  { route: "/billing", title: "Billing", body: "Your plan, payment, and invoices — fully transparent." },
  { route: "/billing", target: '[data-tour="billing-plan"]', title: "Current plan", body: "What you're paying, what's included, and your next renewal date." },
  { route: "/billing", target: '[data-tour="billing-actions"]', title: "Plan actions", body: "Change plan or cancel from here — no phone calls required." },
  { route: "/billing", target: '[data-tour="billing-invoices-heading"]', title: "Invoice history", body: "Every receipt, downloadable as PDF for your records." },

  // ===== REFERRALS =====
  { route: "/referrals", title: "Referrals", body: "Refer other businesses and unlock real discounts." },
  { route: "/referrals", target: '[data-tour="ref-status"]', title: "Your status", body: "Track how close you are to your next free month — 4 referrals = your bill is on us." },
  { route: "/referrals", target: '[data-tour="ref-tiers"]', title: "Tier breakdown", body: "Each signup unlocks a bigger discount. The progression is shown here." },
  { route: "/referrals", target: '[data-tour="ref-calc"]', title: "Savings calculator", body: "Drag to preview exactly what your bill becomes at each referral level." },

  // ===== SUPPORT =====
  { route: "/support", title: "Support", body: "Real human help — chat, FAQ, and a place to request features." },
  { route: "/support", target: '[data-tour="support-shortcuts"]', title: "Shortcuts", body: "Jump straight into chat or replay this tour anytime." },
  { route: "/support", target: '[data-tour="support-chat"]', title: "Live chat", body: "Start a conversation with our team and scroll back through any reply we've ever sent you." },
  { route: "/support", target: '[data-tour="support-faq"]', title: "FAQ", body: "Quick answers to the most common questions — usually faster than waiting for a reply." },
  { route: "/support", target: '[data-tour="support-feature"]', title: "Request a feature", body: "Got an idea? Send it here. We read every one — and you can submit as many as you like." },

  // ===== SETTINGS =====
  { route: "/settings", title: "Settings", body: "Where you customize your AI receptionist end to end." },
  { route: "/settings", target: '[data-tour="settings-account"]', title: "Account", body: "Your login, business logo, and account-level info." },
  { route: "/settings", target: '[data-tour="settings-section-business"]', title: "Business hours", body: "Your phone number, and whether the AI answers 24/7 or only during your set hours." },
  { route: "/settings", target: '[data-tour="settings-section-locations-phone-numbers"]', title: "Locations", body: "Manage every location and phone number — and request new ones right from here." },
  { route: "/settings", target: '[data-tour="settings-section-ai-receptionist"]', title: "AI receptionist", body: "Pick a voice, write greetings, and shape how the AI sounds on the phone." },
  { route: "/settings", target: '[data-tour="settings-section-services"]', title: "Services", body: "Tell the AI what you offer and what it costs — it'll quote callers accurately." },
  { route: "/settings", target: '[data-tour="settings-section-appearance"]', title: "Appearance", body: "Theme and visual preferences for your dashboard." },
  { route: "/settings", target: '[data-tour="settings-section-notifications"]', title: "Notification settings", body: "Cross-link to fine-tune the alerts you receive." },
  { route: "/settings", target: '[data-tour="settings-section-security"]', title: "Security", body: "Password, 2FA, and account protection." },
  { route: "/settings", target: '[data-tour="settings-section-team-access"]', title: "Team access", body: "Invite teammates and control what they can see and do." },

  {
    title: "You're all set 🎉",
    body:
      "That's the full tour. You can replay it anytime from the More menu → Get Started Tour. Now go take some calls!",
  },
];