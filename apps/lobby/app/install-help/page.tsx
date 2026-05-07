import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Install Help — Pecking Order',
  description:
    'Step-by-step instructions for adding Pecking Order to your home screen on iPhone, iPad, and Android.',
};

export default function InstallHelpPage() {
  return (
    <div className="min-h-screen bg-skin-deep font-body text-skin-base">
      <main className="max-w-2xl mx-auto px-6 py-12 md:py-20 space-y-10">
        <header className="space-y-3">
          <Link
            href="/playtest"
            className="inline-block text-[11px] uppercase tracking-widest text-skin-faint hover:text-skin-dim font-display transition-colors"
          >
            ← Back
          </Link>
          <p className="text-[10px] uppercase tracking-widest font-bold text-skin-pink font-display">
            Install Help
          </p>
          <h1 className="font-display font-black text-4xl md:text-5xl uppercase tracking-tight text-skin-base leading-[0.95]">
            Add to Home&nbsp;Screen
          </h1>
          <p className="text-skin-dim text-sm leading-relaxed max-w-prose">
            Pecking Order plays best as a home-screen app. You&apos;ll get push notifications when
            silver lands, when DMs arrive, and when the day&apos;s vote opens — without those, you
            won&apos;t know when to come back.
          </p>
        </header>

        <BrowserCheck />

        <div className="space-y-12">
          <PlatformSection
            tag="iPhone & iPad"
            tagColor="text-skin-pink"
            requirement="Open this game in Safari. Add to Home Screen does NOT work in Chrome, Brave, Firefox, or Edge on iPhone — Apple only allows it from Safari."
          >
            <Step
              number={1}
              title="Tap the Share button"
              body={
                <>
                  Bottom toolbar in Safari (iPhone) or top-right (iPad). Looks like a square with an
                  arrow pointing up out of it.
                </>
              }
              icon={<ShareIcon />}
            />
            <Step
              number={2}
              title={
                <>
                  Scroll until you see <strong>“Add to Home Screen”</strong>
                </>
              }
              body={
                <>
                  It&apos;s in the second list of options, between “Find on Page” and “Markup.” Tap
                  it.
                </>
              }
              icon={<PlusIcon />}
            />
            <Step
              number={3}
              title={
                <>
                  Tap <strong>Add</strong> in the top-right
                </>
              }
              body={
                <>
                  You can rename it first if you want. The icon should be the red Pecking Order
                  “PO” — if you see a generic webclip icon instead, the page didn&apos;t load
                  fully; refresh and try again.
                </>
              }
              icon={<CheckIcon />}
            />
            <Step
              number={4}
              title="Open it from your home screen"
              body={
                <>
                  Tap the new icon. Pecking Order opens full-screen — no Safari URL bar. The first
                  time you open it from the home screen, you&apos;ll be asked to enable
                  notifications. Allow.
                </>
              }
              icon={<HomeIcon />}
            />
          </PlatformSection>

          <PlatformSection
            tag="Android"
            tagColor="text-skin-pink"
            requirement="Open this game in Chrome. Most Android browsers (Edge, Brave, Samsung Internet) will also work, but Chrome is the most reliable."
          >
            <Step
              number={1}
              title="Tap the menu"
              body={<>Three dots in the top-right corner of Chrome.</>}
              icon={<DotsIcon />}
            />
            <Step
              number={2}
              title={
                <>
                  Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>
                </>
              }
              body={
                <>
                  Newer Chrome shows “Install app.” Older shows “Add to Home screen.” Either works.
                  If neither is shown, the page hasn&apos;t qualified as installable yet — refresh
                  and try again.
                </>
              }
              icon={<PlusIcon />}
            />
            <Step
              number={3}
              title="Confirm"
              body={
                <>
                  A dialog asks if you want to install. Tap <strong>Install</strong>. The app
                  appears on your home screen and app drawer.
                </>
              }
              icon={<CheckIcon />}
            />
          </PlatformSection>
        </div>

        <Troubleshooting />

        <footer className="pt-8 border-t border-skin-line">
          <Link
            href="/playtest"
            className="inline-block text-[11px] uppercase tracking-widest text-skin-faint hover:text-skin-dim font-display transition-colors"
          >
            ← Back
          </Link>
        </footer>
      </main>
    </div>
  );
}

function BrowserCheck() {
  return (
    <div className="border border-[rgba(247,197,46,0.4)] bg-[rgba(247,197,46,0.1)] rounded-xl px-5 py-4 space-y-2">
      <p className="text-[10px] uppercase tracking-widest font-bold text-skin-gold mb-1.5 font-display">
        Two things to know
      </p>
      <ul className="text-sm text-skin-dim leading-relaxed space-y-1.5">
        <li>
          <strong className="text-skin-base">iPhone / iPad:</strong> Add to Home Screen only works
          from Safari.
        </li>
        <li>
          <strong className="text-skin-base">Android:</strong> Use Chrome for the most reliable
          install.
        </li>
      </ul>
    </div>
  );
}

function Troubleshooting() {
  return (
    <section className="space-y-5">
      <h2 className="font-display font-bold text-xl uppercase tracking-tight text-skin-gold">
        Doesn&apos;t work?
      </h2>
      <div className="space-y-4 text-sm leading-relaxed text-skin-dim">
        <Issue
          q={<>I&apos;m on iPhone but I don&apos;t see “Add to Home Screen.”</>}
          a={
            <>
              You&apos;re probably not in Safari. Brave, Chrome, Firefox, and Edge on iPhone all
              hide that option — Apple blocks them. Copy the link, paste it into Safari, then
              follow the steps above.
            </>
          }
        />
        <Issue
          q={<>The icon on my home screen is a generic webclip, not the red “PO.”</>}
          a={
            <>
              The page didn&apos;t fully load before you saved it. Open Safari, wait for the page
              to fully render (you should see the cast strip), then re-do the Share &rarr; Add to
              Home Screen steps. Delete the old icon if needed.
            </>
          }
        />
        <Issue
          q={<>I tapped Allow on notifications but I never get them.</>}
          a={
            <>
              On iPhone, this almost always means you opened the game from Safari instead of from
              the home-screen icon. iOS only delivers push to apps opened from the home screen.
              Close Safari, tap the home-screen icon, then re-enable notifications.
            </>
          }
        />
        <Issue
          q={<>I&apos;m on Brave on desktop and notifications won&apos;t turn on.</>}
          a={
            <>
              Brave&apos;s privacy shield blocks the push service. Two options:
              <ol className="list-decimal list-outside pl-5 space-y-1 mt-2">
                <li>Easiest: open this game in Chrome, Safari, or Firefox.</li>
                <li>
                  Stay on Brave: go to{' '}
                  <code className="text-skin-base bg-[rgba(10,10,10,0.4)] px-1 py-0.5 rounded">
                    brave://settings/privacy
                  </code>{' '}
                  → turn on “Use Google services for push messaging” → restart Brave.
                </li>
              </ol>
            </>
          }
        />
        <Issue
          q={<>None of this is working.</>}
          a={
            <>
              Reply to the email that brought you here, or DM whoever invited you. We&apos;ll get
              you in.
            </>
          }
        />
      </div>
    </section>
  );
}

function PlatformSection({
  tag,
  tagColor,
  requirement,
  children,
}: {
  tag: string;
  tagColor: string;
  requirement: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <p className={`text-[10px] uppercase tracking-widest font-bold font-display ${tagColor}`}>
          {tag}
        </p>
        <p className="text-sm text-skin-dim leading-relaxed border-l-2 border-[rgba(247,197,46,0.4)] pl-3">
          {requirement}
        </p>
      </div>
      <ol className="space-y-5">{children}</ol>
    </section>
  );
}

function Step({
  number,
  title,
  body,
  icon,
}: {
  number: number;
  title: React.ReactNode;
  body: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-skin-pink text-white font-display font-black text-sm flex items-center justify-center">
          {number}
        </div>
      </div>
      <div className="flex-1 space-y-2 pt-0.5">
        <div className="flex items-baseline gap-2.5">
          <h3 className="font-display font-bold text-base uppercase tracking-tight text-skin-base leading-tight">
            {title}
          </h3>
          <span className="flex-shrink-0 text-skin-faint" aria-hidden="true">
            {icon}
          </span>
        </div>
        <p className="text-sm text-skin-dim leading-relaxed">{body}</p>
      </div>
    </li>
  );
}

function Issue({ q, a }: { q: React.ReactNode; a: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-skin-base font-display font-bold text-sm uppercase tracking-tight">
        {q}
      </p>
      <div className="text-skin-dim text-sm leading-relaxed">{a}</div>
    </div>
  );
}

// Inline SVG icons — kept here rather than pulling in a Phosphor dependency
// for a single help page. All sized 18×18, currentColor.

function ShareIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v13" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  );
}
