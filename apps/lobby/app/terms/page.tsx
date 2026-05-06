import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service — Pecking Order',
  description:
    'The terms that apply when you join the Pecking Order playtest and play games on the platform.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-skin-deep font-body text-skin-base">
      <main className="max-w-2xl mx-auto px-6 py-12 md:py-20 space-y-10">
        <div className="border border-[rgba(247,197,46,0.4)] bg-[rgba(247,197,46,0.1)] rounded-xl px-5 py-4">
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
            Terms of Service
          </h1>
          <p className="text-skin-faint text-sm">Last updated: 3 May 2026</p>
        </header>

        <Section title="Acceptance">
          <p>
            By signing up for the Pecking Order playtest or playing a game, you agree to these
            terms. If you don&apos;t agree, please don&apos;t sign up.
          </p>
        </Section>

        <Section title="Eligibility">
          <p>
            You must be at least 13 years old to use Pecking Order (16 in the EU and UK). By
            signing up, you confirm you meet this age requirement.
          </p>
        </Section>

        <Section title="The playtest">
          <p>
            Pecking Order is in active development. The playtest is <strong>free</strong>. The game
            may change, break, restart, or be paused while we work on it. We don&apos;t guarantee
            uptime, save persistence, or that any specific feature will continue to exist. By
            signing up you accept that you&apos;re an early tester, not a customer.
          </p>
        </Section>

        <Section title="Your account">
          <p>
            We use magic-link sign-in — no password. Keep your email account secure; anyone with
            access to it can access your Pecking Order account. You&apos;re responsible for what
            happens under your account.
          </p>
        </Section>

        <Section title="How to behave">
          <p>While playing Pecking Order you agree not to:</p>
          <ul className="list-disc list-outside pl-5 space-y-1.5">
            <li>Harass, threaten, dox, or abuse other players, in or out of game.</li>
            <li>Share personally identifying information about other players outside the game.</li>
            <li>Use automation, bots, or third-party tools to gain an unfair advantage.</li>
            <li>Coordinate with other players outside the game in ways that break the game design.</li>
            <li>Post illegal content, hate speech, or content sexualizing minors.</li>
            <li>Impersonate Pecking Order staff or other players.</li>
          </ul>
          <p>
            In-character scheming, lying, betrayal, and forming alliances are <strong>encouraged</strong>
            — that&apos;s the game. Out-of-character harassment is not.
          </p>
        </Section>

        <Section title="Content you post">
          <p>
            You retain ownership of messages, votes, and other content you create while playing.
            By posting it, you grant us a worldwide, non-exclusive, royalty-free license to host,
            display, and transmit it within Pecking Order so the game can function. We may also
            use anonymized highlights from games for marketing — without sharing your real
            identity.
          </p>
        </Section>

        <Section title="Our intellectual property">
          <p>
            The Pecking Order name, logo, software, game design, persona art, and all related
            assets belong to us. You may not copy, redistribute, reverse-engineer, or build
            competing products from the platform.
          </p>
        </Section>

        <Section title="Termination">
          <p>
            We may suspend or remove your account at any time, with or without notice, if we
            believe you&apos;ve violated these terms or are harming other players. You can delete
            your account at any time by emailing <a href="mailto:hello@peckingorder.ca" className="text-skin-gold hover:brightness-110 underline-offset-2 hover:underline">hello@peckingorder.ca</a>.
          </p>
        </Section>

        <Section title="No warranty">
          <p>
            Pecking Order is provided &quot;as is.&quot; We make no warranties of any kind, express
            or implied, including merchantability, fitness for a particular purpose, or
            non-infringement. The playtest may have bugs, downtime, or data loss; you accept that
            risk by signing up.
          </p>
        </Section>

        <Section title="Limit of liability">
          <p>
            To the fullest extent permitted by law, Pecking Order and its operators are not liable
            for any indirect, incidental, consequential, special, or punitive damages arising out
            of your use of the platform. Our aggregate liability to you will not exceed the
            amount you&apos;ve paid us in the past twelve months — which, during the playtest, is
            zero.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update these terms as the playtest evolves. The &quot;Last updated&quot; date at
            the top reflects the most recent change. For material changes, we will email you.
            Continuing to use the platform after changes means you accept the new terms.
          </p>
        </Section>

        <Section title="Governing law">
          <p>
            These terms are governed by the laws of the jurisdiction in which Pecking Order is
            operated. Any dispute will be resolved in the courts of that jurisdiction.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these terms? Email <a href="mailto:hello@peckingorder.ca" className="text-skin-gold hover:brightness-110 underline-offset-2 hover:underline">hello@peckingorder.ca</a>.
          </p>
        </Section>

        <footer className="pt-8 border-t border-[rgba(245,243,240,0.2)] flex flex-wrap gap-x-6 gap-y-3 items-center justify-between">
          <Link
            href="/playtest"
            className="text-[11px] uppercase tracking-widest text-skin-faint hover:text-skin-dim font-display transition-colors"
          >
            ← Back to playtest
          </Link>
          <Link
            href="/privacy"
            className="text-[11px] uppercase tracking-widest text-skin-faint hover:text-skin-dim font-display transition-colors"
          >
            Privacy Policy →
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
