export type CallStatus = "booked" | "answered" | "missed-followup";

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
};

export type Booking = {
  id: string;
  customer: string;
  service: string;
  startsAt: string; // ISO
  durationMin: number;
  phone: string;
  smsConfirmed: boolean;
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
