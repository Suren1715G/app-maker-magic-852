export type CallStatus = "booked" | "answered" | "missed-followup";

export type CallTag = "lead" | "booked" | "spam" | "follow-up";

export type Call = {
  id: string;
  caller: string;
  phone: string;
  startedAt: string; // ISO
  durationSec: number;
  status: CallStatus;
  summary: string;
  transcript: { speaker: "AI" | "Caller"; text: string; at: string }[];
  bookingId?: string;
  tag?: CallTag;
  recordingUrl?: string;
};

export type Booking = {
  id: string;
  customer: string;
  service: string;
  startsAt: string; // ISO
  durationMin: number;
  phone: string;
  smsConfirmed: boolean;
  status?: "scheduled" | "completed" | "cancelled" | "no-show";
};

export type SmsLog = {
  id: string;
  to: string;
  customer: string;
  type: "confirmation" | "reminder";
  body: string;
  sentAt: string;
  delivered: boolean;
};

const today = new Date();
const iso = (offsetMin: number) => {
  const d = new Date(today.getTime() + offsetMin * 60_000);
  return d.toISOString();
};

export const calls: Call[] = [
  {
    id: "c1",
    caller: "Marcus Lee",
    phone: "+1 (415) 555-0142",
    startedAt: iso(-22),
    durationSec: 142,
    status: "booked",
    summary: "Booked a deep clean for Friday 2:00 PM. Confirmed address and pricing.",
    bookingId: "b1",
    tag: "booked",
    recordingUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    transcript: [
      { speaker: "AI", text: "Hi, you've reached SGS. How can I help today?", at: iso(-22) },
      { speaker: "Caller", text: "I need a deep cleaning for my apartment.", at: iso(-22) },
      { speaker: "AI", text: "Absolutely. What day works best?", at: iso(-22) },
      { speaker: "Caller", text: "Friday afternoon if possible.", at: iso(-22) },
      { speaker: "AI", text: "Friday at 2:00 PM is open. Should I book it?", at: iso(-22) },
      { speaker: "Caller", text: "Yes please.", at: iso(-22) },
    ],
  },
  {
    id: "c2",
    caller: "Priya Shah",
    phone: "+1 (628) 555-0193",
    startedAt: iso(-58),
    durationSec: 98,
    status: "answered",
    summary: "Asked about pricing for weekly service. Quoted $120/visit. Will call back.",
    tag: "lead",
    recordingUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    transcript: [
      { speaker: "AI", text: "SGS, how can I help?", at: iso(-58) },
      { speaker: "Caller", text: "What do you charge for weekly cleaning?", at: iso(-58) },
      { speaker: "AI", text: "Weekly visits start at $120. Want me to book a free walkthrough?", at: iso(-58) },
      { speaker: "Caller", text: "Let me think about it, I'll call back.", at: iso(-58) },
    ],
  },
  {
    id: "c3",
    caller: "James O'Connor",
    phone: "+1 (510) 555-0117",
    startedAt: iso(-95),
    durationSec: 211,
    status: "booked",
    summary: "Booked move-out clean for next Tuesday 9:00 AM. 2BR apartment.",
    bookingId: "b2",
    tag: "booked",
    recordingUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    transcript: [
      { speaker: "AI", text: "Hi, this is SGS. How can I help?", at: iso(-95) },
      { speaker: "Caller", text: "I'm moving out and need a deep clean.", at: iso(-95) },
      { speaker: "AI", text: "Got it. What day are you moving?", at: iso(-95) },
      { speaker: "Caller", text: "Wednesday, so Tuesday morning would work.", at: iso(-95) },
      { speaker: "AI", text: "Tuesday at 9 AM is open. Booked it for you.", at: iso(-95) },
    ],
  },
  {
    id: "c4",
    caller: "Sofia Martinez",
    phone: "+1 (415) 555-0188",
    startedAt: iso(-180),
    durationSec: 76,
    status: "answered",
    summary: "Reschedule request for Thursday's appointment. Moved to 4 PM.",
    tag: "follow-up",
    recordingUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    transcript: [
      { speaker: "AI", text: "SGS, how can I help?", at: iso(-180) },
      { speaker: "Caller", text: "Can I move my Thursday appointment later?", at: iso(-180) },
      { speaker: "AI", text: "Sure. 4 PM works — I've moved it.", at: iso(-180) },
    ],
  },
  {
    id: "c5",
    caller: "Unknown",
    phone: "+1 (650) 555-0102",
    startedAt: iso(-260),
    durationSec: 12,
    status: "missed-followup",
    summary: "Caller hung up before booking. Follow-up SMS sent automatically.",
    tag: "spam",
    transcript: [
      { speaker: "AI", text: "SGS, how can I help?", at: iso(-260) },
      { speaker: "Caller", text: "...", at: iso(-260) },
    ],
  },
];

export const bookings: Booking[] = [
  {
    id: "b1",
    customer: "Marcus Lee",
    service: "Deep Clean",
    startsAt: iso(60 * 26),
    durationMin: 180,
    phone: "+1 (415) 555-0142",
    smsConfirmed: true,
  },
  {
    id: "b2",
    customer: "James O'Connor",
    service: "Move-out Clean",
    startsAt: iso(60 * 96),
    durationMin: 240,
    phone: "+1 (510) 555-0117",
    smsConfirmed: true,
  },
  {
    id: "b3",
    customer: "Sofia Martinez",
    service: "Standard Clean",
    startsAt: iso(60 * 50),
    durationMin: 120,
    phone: "+1 (415) 555-0188",
    smsConfirmed: true,
  },
  {
    id: "b4",
    customer: "Daniel Kim",
    service: "Office Clean",
    startsAt: iso(60 * 8),
    durationMin: 90,
    phone: "+1 (408) 555-0166",
    smsConfirmed: false,
  },
];

export const sms: SmsLog[] = [
  {
    id: "s1",
    to: "+1 (415) 555-0142",
    customer: "Marcus Lee",
    type: "confirmation",
    body: "Hi Marcus — your deep clean is booked for Fri 2:00 PM. Reply STOP to opt out.",
    sentAt: iso(-21),
    delivered: true,
  },
  {
    id: "s2",
    to: "+1 (510) 555-0117",
    customer: "James O'Connor",
    type: "confirmation",
    body: "Move-out clean booked Tue 9:00 AM. We'll text a reminder the day before.",
    sentAt: iso(-94),
    delivered: true,
  },
  {
    id: "s3",
    to: "+1 (650) 555-0102",
    customer: "Unknown caller",
    type: "confirmation",
    body: "Hi — sorry we missed you. Reply YES to book a free quote.",
    sentAt: iso(-259),
    delivered: true,
  },
  {
    id: "s4",
    to: "+1 (408) 555-0166",
    customer: "Daniel Kim",
    type: "reminder",
    body: "Reminder: your office clean is tomorrow morning. See you then!",
    sentAt: iso(-15),
    delivered: false,
  },
];

export const stats = {
  callsToday: 18,
  bookingsToday: 7,
  conversionRate: 0.39,
  smsSent: 24,
  minutesSaved: 142,
  revenueBookedToday: 1840,
};

/* ---------------- Leads (CRM) ---------------- */
export type LeadStatus = "new" | "contacted" | "converted" | "lost";
export type LeadSource = "call" | "sms" | "web";
export type Lead = {
  id: string;
  name: string;
  phone: string;
  source: LeadSource;
  status: LeadStatus;
  createdAt: string;
  lastContactAt: string;
  notes: string;
  estValue: number;
};

export const leads: Lead[] = [
  { id: "l1", name: "Marcus Lee", phone: "+1 (415) 555-0142", source: "call", status: "converted", createdAt: iso(-60 * 24), lastContactAt: iso(-22), notes: "Booked deep clean. Repeat customer potential.", estValue: 320 },
  { id: "l2", name: "Priya Shah", phone: "+1 (628) 555-0193", source: "call", status: "contacted", createdAt: iso(-60), lastContactAt: iso(-58), notes: "Wants weekly rate. Will call back Friday.", estValue: 480 },
  { id: "l3", name: "James O'Connor", phone: "+1 (510) 555-0117", source: "call", status: "converted", createdAt: iso(-60 * 30), lastContactAt: iso(-95), notes: "Move-out clean. Referred by Marcus.", estValue: 540 },
  { id: "l4", name: "Sofia Martinez", phone: "+1 (415) 555-0188", source: "sms", status: "converted", createdAt: iso(-60 * 72), lastContactAt: iso(-180), notes: "Recurring customer.", estValue: 240 },
  { id: "l5", name: "Daniel Kim", phone: "+1 (408) 555-0166", source: "sms", status: "contacted", createdAt: iso(-60 * 6), lastContactAt: iso(-15), notes: "Office building. Negotiating monthly.", estValue: 1200 },
  { id: "l6", name: "Unknown caller", phone: "+1 (650) 555-0102", source: "call", status: "new", createdAt: iso(-260), lastContactAt: iso(-260), notes: "Hung up. Auto-SMS sent.", estValue: 0 },
  { id: "l7", name: "Ava Robinson", phone: "+1 (415) 555-0211", source: "web", status: "new", createdAt: iso(-30), lastContactAt: iso(-30), notes: "Web form: 3BR house, asked about eco products.", estValue: 280 },
  { id: "l8", name: "Noah Patel", phone: "+1 (510) 555-0299", source: "call", status: "lost", createdAt: iso(-60 * 96), lastContactAt: iso(-60 * 90), notes: "Went with competitor.", estValue: 0 },
];

/* ---------------- Reviews ---------------- */
export type Review = {
  id: string;
  customer: string;
  rating: number;
  body: string;
  postedAt: string;
  source: "google" | "yelp";
};
export const reviews: Review[] = [
  { id: "r1", customer: "Marcus L.", rating: 5, body: "Booking was effortless. The AI was friendlier than most humans.", postedAt: iso(-60 * 18), source: "google" },
  { id: "r2", customer: "Sofia M.", rating: 5, body: "Texted me a confirmation in seconds. 10/10.", postedAt: iso(-60 * 50), source: "google" },
  { id: "r3", customer: "James O.", rating: 5, body: "Showed up on time, did a great job.", postedAt: iso(-60 * 80), source: "google" },
  { id: "r4", customer: "Priya S.", rating: 4, body: "Good service. Pricing could be clearer up front.", postedAt: iso(-60 * 110), source: "google" },
  { id: "r5", customer: "Daniel K.", rating: 5, body: "Best decision I made for the office.", postedAt: iso(-60 * 130), source: "google" },
];

/* ---------------- Notifications ---------------- */
export type AppNotification = {
  id: string;
  type: "lead" | "booking" | "missed" | "review" | "summary";
  title: string;
  body: string;
  at: string;
  read: boolean;
};
export const notifications: AppNotification[] = [
  { id: "n1", type: "lead", title: "New lead", body: "Marcus Lee called and was converted.", at: iso(-22), read: false },
  { id: "n2", type: "booking", title: "Appointment booked", body: "Friday 2:00 PM — Deep Clean.", at: iso(-22), read: false },
  { id: "n3", type: "missed", title: "Missed call", body: "Auto follow-up SMS sent to +1 (650) 555-0102.", at: iso(-260), read: true },
  { id: "n4", type: "review", title: "New 5★ review", body: "Marcus L. on Google.", at: iso(-60 * 18), read: true },
  { id: "n5", type: "summary", title: "Daily summary", body: "18 calls · 7 bookings · $1,840 booked.", at: iso(-60 * 9), read: true },
];

/* ---------------- Invoices ---------------- */
export type Invoice = {
  id: string;
  number: string;
  amount: number;
  paidAt: string;
  status: "paid" | "due" | "failed";
};
export const invoices: Invoice[] = [
  { id: "i1", number: "INV-2025-004", amount: 149, paidAt: iso(-60 * 24 * 4), status: "paid" },
  { id: "i2", number: "INV-2025-003", amount: 149, paidAt: iso(-60 * 24 * 34), status: "paid" },
  { id: "i3", number: "INV-2025-002", amount: 149, paidAt: iso(-60 * 24 * 64), status: "paid" },
  { id: "i4", number: "INV-2025-001", amount: 149, paidAt: iso(-60 * 24 * 94), status: "paid" },
];

/* ---------------- Referrals ---------------- */
export type Referral = { id: string; name: string; status: "joined" | "trial" | "pending"; at: string };
export const referrals: Referral[] = [
  { id: "rf1", name: "Bright Lawn Care", status: "joined", at: iso(-60 * 24 * 12) },
  { id: "rf2", name: "Coastal HVAC", status: "trial", at: iso(-60 * 24 * 4) },
  { id: "rf3", name: "Pearl Hair Studio", status: "pending", at: iso(-60 * 24 * 1) },
];

/* ---------------- Analytics: 7-day series ---------------- */
export const weeklySeries = (() => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const calls = [12, 18, 14, 22, 24, 9, 6];
  const bookings = [4, 6, 5, 8, 9, 3, 2];
  return days.map((d, i) => ({ day: d, calls: calls[i], bookings: bookings[i], revenue: bookings[i] * 240 }));
})();

/* 24h x 7day call heatmap */
export const heatmap = (() => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((day) => ({
    day,
    hours: Array.from({ length: 24 }, (_, h) => {
      // Lower at night, peak 9-11am and 4-6pm
      let v = 0;
      if (h >= 8 && h <= 19) v = Math.max(0, Math.round(Math.sin(((h - 6) / 14) * Math.PI) * 9 + (Math.random() * 3 - 1)));
      if (day === "Sat" || day === "Sun") v = Math.max(0, Math.round(v * 0.4));
      return v;
    }),
  }));
})();

/* ---------------- SMS Threads ---------------- */
export type SmsMessage = { id: string; from: "ai" | "lead"; body: string; at: string };
export type SmsThread = {
  id: string;
  customer: string;
  phone: string;
  unread: number;
  flagged: boolean;
  messages: SmsMessage[];
};
export const threads: SmsThread[] = [
  {
    id: "t1", customer: "Marcus Lee", phone: "+1 (415) 555-0142", unread: 0, flagged: false,
    messages: [
      { id: "m1", from: "ai", body: "Hi Marcus — your deep clean is booked Fri 2:00 PM. Reply STOP to opt out.", at: iso(-21) },
      { id: "m2", from: "lead", body: "Thanks! Can you also do the windows?", at: iso(-19) },
      { id: "m3", from: "ai", body: "Yes — I added interior windows for $40. Total now $360.", at: iso(-18) },
      { id: "m4", from: "lead", body: "Perfect.", at: iso(-17) },
    ],
  },
  {
    id: "t2", customer: "Daniel Kim", phone: "+1 (408) 555-0166", unread: 2, flagged: true,
    messages: [
      { id: "m5", from: "ai", body: "Reminder: your office clean is tomorrow morning.", at: iso(-15) },
      { id: "m6", from: "lead", body: "Need to push to Thursday — possible?", at: iso(-14) },
      { id: "m7", from: "lead", body: "Also — do you bring vacuum?", at: iso(-13) },
    ],
  },
  {
    id: "t3", customer: "Sofia Martinez", phone: "+1 (415) 555-0188", unread: 0, flagged: false,
    messages: [
      { id: "m8", from: "ai", body: "Your appointment is moved to Thursday 4:00 PM. ✅", at: iso(-179) },
      { id: "m9", from: "lead", body: "Great, thank you!", at: iso(-178) },
    ],
  },
  {
    id: "t4", customer: "Unknown caller", phone: "+1 (650) 555-0102", unread: 0, flagged: false,
    messages: [
      { id: "m10", from: "ai", body: "Hi — sorry we missed you. Reply YES to book a free quote.", at: iso(-259) },
    ],
  },
];
