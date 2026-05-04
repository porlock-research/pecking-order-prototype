import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — Pecking Order',
  description:
    'How we handle the information you give us when you sign up for the Pecking Order playtest.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-skin-deep font-body text-skin-base">
      <main className="max-w-2xl mx-auto px-6 py-12 md:py-20 space-y-10">
        <div className="border border-skin-gold/40 bg-skin-gold/10 rounded-xl px-5 py-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-skin-gold mb-1.5 font-display">
            Draft — Lawyer Review Required
          </p>
          <p className="text-sm text-skin-dim leading-relaxed">
            This is placeholder content for the Pecking Order playtest. It must be reviewed and
            revised by qualified legal counsel before public launch.
          </p>
        </div>

        <header className="space-y-3">
          <Link
            href="/playtest"
            className="inline-block text-[11px] uppercase tracking-widest text-skin-faint hover:text-skin-dim font-display transition-colors"
          >
            ← Back to playtest
          </Link>
          <h1 className="font-display font-black text-4xl md:text-5xl uppercase tracking-tight text-skin-base leading-[0.95]">
            Privacy Policy
          </h1>
          <p className="text-skin-faint text-sm">Last updated: 3 May 2026</p>
        </header>

        <Section title="What we collect">
          <p>When you sign up for the Pecking Order playtest, we ask for:</p>
          <ul className="list-disc list-outside pl-5 space-y-1.5">
            <li>Your email address (required)</li>
            <li>Your phone number (optional)</li>
            <li>Your preferred messaging app (optional)</li>
            <li>How you heard about us (optional, multiple choice)</li>
            <li>A short note about who referred you, if any (optional)</li>
            <li>A referral code, if you signed up via someone else&apos;s link</li>
          </ul>
          <p>
            We also collect technical information needed to operate the service: your IP address
            (briefly, for spam protection via Cloudflare Turnstile), browser type, and basic
            page-view events.
          </p>
          <p>
            We do <strong>not</strong> collect payment information — Pecking Order is free during
            the playtest.
          </p>
        </Section>

        <Section title="Why we collect it">
          <ul className="list-disc list-outside pl-5 space-y-1.5">
            <li>
              <strong>Email</strong> — to send you a signup confirmation, invite you to playtests,
              and send optional game-day reminders.
            </li>
            <li>
              <strong>Phone</strong> — only if you provide it, only for SMS game-day reminders if
              you opt in.
            </li>
            <li>
              <strong>Messaging app</strong> — so we know how best to reach you about your cohort.
            </li>
            <li>
              <strong>Source and referral information</strong> — to understand how new players are
              finding us, and to credit referrers.
            </li>
          </ul>
        </Section>

        <Section title="How we store it">
          <p>
            Your email and phone number are <strong>encrypted at rest</strong> in our database. We
            store a one-way hashed version of your email for de-duplication only. The database
            runs on Cloudflare D1.
          </p>
        </Section>

        <Section title="Who we share it with">
          <p>We do not sell your information. We share it only with the service providers we use to operate the playtest:</p>
          <ul className="list-disc list-outside pl-5 space-y-1.5">
            <li>
              <strong>Resend</strong> — to send confirmation emails and playtest invitations.
            </li>
            <li>
              <strong>Cloudflare</strong> — for hosting, spam protection (Turnstile), and basic
              analytics.
            </li>
          </ul>
        </Section>

        <Section title="Your rights">
          <p>
            You can request access to, correction of, or deletion of your personal information at
            any time by emailing <a href="mailto:hello@peckingorder.ca" className="text-skin-gold hover:brightness-110 underline-offset-2 hover:underline">hello@peckingorder.ca</a>. We will honor your request within 30 days.
          </p>
          <p>
            You can unsubscribe from playtest emails at any time using the unsubscribe link in any
            email we send.
          </p>
        </Section>

        <Section title="Cookies and local storage">
          <p>We use only what we need to operate the site:</p>
          <ul className="list-disc list-outside pl-5 space-y-1.5">
            <li>Session cookies for sign-in flows.</li>
            <li>Cloudflare Turnstile, for spam protection on the signup form.</li>
            <li>
              Local storage on your device to remember whether you&apos;ve already signed up, so we
              can show you a confirmation screen instead of a fresh form.
            </li>
          </ul>
          <p>We do not use third-party advertising cookies or cross-site tracking.</p>
        </Section>

        <Section title="Children">
          <p>
            Pecking Order is intended for users 13 years of age and older (16 in the EU and UK).
            We do not knowingly collect personal information from younger children. If you believe
            we have inadvertently collected such information, please contact us so we can delete
            it.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update this policy as the playtest evolves. The &quot;Last updated&quot; date at
            the top reflects the most recent change. For material changes, we will email you.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about your privacy? Email <a href="mailto:hello@peckingorder.ca" className="text-skin-gold hover:brightness-110 underline-offset-2 hover:underline">hello@peckingorder.ca</a>.
          </p>
        </Section>

        <footer className="pt-8 border-t border-skin-base/20 flex flex-wrap gap-x-6 gap-y-3 items-center justify-between">
          <Link
            href="/playtest"
            className="text-[11px] uppercase tracking-widest text-skin-faint hover:text-skin-dim font-display transition-colors"
          >
            ← Back to playtest
          </Link>
          <Link
            href="/terms"
            className="text-[11px] uppercase tracking-widest text-skin-faint hover:text-skin-dim font-display transition-colors"
          >
            Terms of Service →
          </Link>
        </footer>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 text-sm leading-relaxed text-skin-dim">
      <h2 className="font-display font-bold text-xl uppercase tracking-tight text-skin-gold">
        {title}
      </h2>
      {children}
    </section>
  );
}
