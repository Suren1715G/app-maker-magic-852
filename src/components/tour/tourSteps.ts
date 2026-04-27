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
  {
    route: "/",
    target: '[data-tour="page-header"]',
    title: "Home",
    body: "Your daily snapshot — live calls, today's bookings, and key stats all in one place.",
  },
  {
    route: "/",
    target: '[data-tour="bottom-nav"]',
    title: "Bottom navigation",
    body: "Jump between the four main sections from here. Tap More for everything else.",
  },
  {
    route: "/calls",
    target: '[data-tour="page-header"]',
    title: "Calls",
    body: "Every call your AI receptionist handled — with full transcripts, recordings, and AI summaries.",
  },
  {
    route: "/sms",
    target: '[data-tour="page-header"]',
    title: "Messages",
    body: "Two-way text conversations the AI handled on your behalf. Jump in and reply anytime.",
  },
  {
    route: "/calendar",
    target: '[data-tour="page-header"]',
    title: "Calendar",
    body: "All bookings the AI made for you, synced and ready to manage.",
  },
  {
    route: "/",
    target: '[data-tour="nav-more"]',
    title: "More menu",
    body: "Tap More to open the rest of your tools — Notes, Analytics, Billing, Support and beyond.",
  },
  {
    route: "/notes",
    target: '[data-tour="page-header"]',
    title: "Notes",
    body: "Quick notes and reminders for your team — keep context where the calls happen.",
  },
  {
    route: "/analytics",
    target: '[data-tour="page-header"]',
    title: "Analytics",
    body: "Charts, trends, and ROI — see exactly what the AI is doing for your business.",
  },
  {
    route: "/notifications",
    target: '[data-tour="page-header"]',
    title: "Notifications",
    body: "Get alerted when something matters. Tune what you want to hear about right here.",
  },
  {
    route: "/assistant",
    target: '[data-tour="page-header"]',
    title: "AI Analyst",
    body: "Ask questions about your data in plain English — booking trends, missed calls, anything.",
  },
  {
    route: "/billing",
    target: '[data-tour="page-header"]',
    title: "Billing",
    body: "Your plan, invoices, and payment details — all transparent, no surprises.",
  },
  {
    route: "/referrals",
    target: '[data-tour="page-header"]',
    title: "Referrals",
    body: "Refer another business and you both get a free month. Share your code from here.",
  },
  {
    route: "/support",
    target: '[data-tour="page-header"]',
    title: "Support",
    body: "Live chat with our team and request new features. We typically reply within an hour.",
  },
  {
    route: "/settings",
    target: '[data-tour="page-header"]',
    title: "Settings",
    body: "Customize your business info, AI behaviour, voice, hours, and more.",
  },
  {
    title: "You're all set 🎉",
    body:
      "That's the full tour. You can replay it anytime from the More menu → Get Started Tour. Now go take some calls!",
  },
];