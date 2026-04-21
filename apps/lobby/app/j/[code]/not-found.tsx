export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-skin-deep p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="font-display text-2xl font-black text-skin-gold">Invite not found</h1>
        <p className="text-sm text-skin-dim">
          Double-check the link, or ask whoever invited you to send it again.
        </p>
      </div>
    </div>
  );
}
