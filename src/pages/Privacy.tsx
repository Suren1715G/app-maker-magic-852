import { Card } from "@/components/ui/card";

const thirdParties = [
  { name: "ElevenLabs", purpose: "AI voice call audio processing & storage" },
  { name: "Twilio", purpose: "Phone numbers, inbound calls, SMS messages" },
  { name: "n8n", purpose: "Backend automation workflows" },
  { name: "Google Calendar", purpose: "Appointment booking sync & storage" },
];

const sections = [
  {
    title: "Who We Are",
    body: (
      <>
        <p>
          SGS Reception Dashboard provides an AI-powered receptionist service for service-based businesses. Our platform handles inbound calls, appointment bookings, and SMS communications on behalf of our business clients.
        </p>
        <p>
          This policy applies to users of the SGS Reception Dashboard mobile app and any related services.
        </p>
      </>
    ),
  },
  {
    title: "Information We Collect",
    body: (
      <>
        <p>We collect the following categories of information to operate the service:</p>
        <ul>
          <li><strong>Call Logs:</strong> Inbound call records including phone numbers, timestamps, and call duration.</li>
          <li><strong>Audio Recordings:</strong> AI call audio is processed and stored by ElevenLabs, our voice AI provider. Recordings are not accessed or reviewed by SGS staff.</li>
          <li><strong>Appointment & Booking Data:</strong> Booking details including date, time, and service type, synced via Google Calendar.</li>
          <li><strong>SMS Messages:</strong> Outbound SMS confirmations and notifications sent on behalf of your business via Twilio.</li>
          <li><strong>Account Information:</strong> Business name and login credentials used to access the dashboard.</li>
        </ul>
      </>
    ),
  },
  {
    title: "How We Use Your Information",
    body: (
      <>
        <p>We use the information we collect solely to provide and improve the SGS Reception Dashboard service:</p>
        <ul>
          <li>To answer inbound calls and book appointments on your behalf</li>
          <li>To display call logs, booking stats, and SMS history in your dashboard</li>
          <li>To send automated appointment confirmations via SMS</li>
          <li>To sync bookings to your Google Calendar</li>
          <li>To troubleshoot technical issues with the AI receptionist</li>
        </ul>
        <p>
          We do <strong>not</strong> sell your data, use it for advertising, or share it with any third party outside of what is required to operate the service.
        </p>
      </>
    ),
  },
  {
    title: "Third-Party Services",
    body: (
      <>
        <p>SGS Reception Dashboard integrates with the following third-party providers to operate the service:</p>
        <div className="not-prose mt-4 grid gap-3 sm:grid-cols-2">
          {thirdParties.map((p) => (
            <Card key={p.name} className="glass p-4">
              <div className="font-display text-base font-semibold">{p.name}</div>
              <div className="text-sm text-muted-foreground mt-1">{p.purpose}</div>
            </Card>
          ))}
        </div>
        <p className="mt-4">
          Audio recordings processed by ElevenLabs are retained according to ElevenLabs' own data retention policy. SGS staff do not access or listen to these recordings. You may request deletion of your audio data at any time by contacting us.
        </p>
      </>
    ),
  },
  {
    title: "Payments & Referrals",
    body: (
      <p>
        All payments and referral transactions are handled on our external website and are governed by that website's separate privacy policy. The SGS Reception Dashboard app does not collect, process, or store any payment card information.
      </p>
    ),
  },
  {
    title: "Data Retention",
    body: (
      <>
        <p>
          We retain your call logs, booking records, and account data for as long as your account is active. If you cancel your subscription, your data will be deleted within 30 days of account closure, unless otherwise required by law.
        </p>
        <p>Audio data stored by ElevenLabs is subject to their own retention timeline. Contact us to request early deletion.</p>
      </>
    ),
  },
  {
    title: "Your Rights",
    body: (
      <>
        <p>You have the right to:</p>
        <ul>
          <li>Access the personal data we hold about your account</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your data at any time</li>
          <li>Request deletion of audio recordings stored by ElevenLabs</li>
          <li>Withdraw consent and close your account</li>
        </ul>
        <p>To exercise any of these rights, contact us at the email below. We will respond within 30 days.</p>
      </>
    ),
  },
  {
    title: "Children's Privacy",
    body: (
      <p>
        SGS Reception Dashboard is designed for business use only and is not directed at children under the age of 13. We do not knowingly collect personal information from children.
      </p>
    ),
  },
  {
    title: "Changes to This Policy",
    body: (
      <p>
        We may update this Privacy Policy from time to time. When we do, we will update the "Last Updated" date at the top of this page. Continued use of the app after changes are posted constitutes your acceptance of the updated policy.
      </p>
    ),
  },
  {
    title: "Contact Us",
    body: (
      <>
        <p>If you have any questions about this Privacy Policy or how your data is handled, please contact us:</p>
        <p>
          <strong>Email:</strong>{" "}
          <a className="text-primary hover:underline" href="mailto:sgsaireception@gmail.com">
            sgsaireception@gmail.com
          </a>
          <br />
          <strong>Company:</strong> SGS Reception Dashboard
        </p>
      </>
    ),
  },
];

export default function Privacy() {
  return (
    <main className="min-h-screen w-full">
      <div className="mx-auto w-full max-w-[720px] px-5 sm:px-8 py-12 md:py-16">
        <header className="mb-10">
          <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">SGS Reception Dashboard</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Effective Date: May 4, 2026 · Last Updated: May 4, 2026 · Version 1.0
          </p>
          <p className="mt-6 text-base text-foreground/80 italic border-l-2 border-primary/60 pl-4">
            This Privacy Policy explains how SGS Reception Dashboard collects, uses, and protects information when you use our AI receptionist platform. We are committed to being transparent about our data practices.
          </p>
        </header>

        <div className="space-y-10">
          {sections.map((s, i) => (
            <section key={s.title}>
              <h2 className="font-display text-2xl font-semibold mb-3">
                <span className="text-primary mr-2">{i + 1}.</span>
                {s.title}
              </h2>
              <div className="space-y-3 text-foreground/85 leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ul]:my-2 [&_p]:text-[15px]">
                {s.body}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-16 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          © 2026 SGS Reception Dashboard. All rights reserved.
        </footer>
      </div>
    </main>
  );
}