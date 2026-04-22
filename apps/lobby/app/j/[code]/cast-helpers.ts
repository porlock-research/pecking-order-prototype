export interface JoinedPlayer {
  personaId: string;
  personaName: string;
  personaStereotype: string;
  displayLabel: string;
}

export function displayLabelFor(p: {
  displayName: string | null;
  contactHandle: string | null;
  personaName: string;
}): string {
  if (p.displayName && p.displayName.trim()) return p.displayName.trim();
  if (p.contactHandle && p.contactHandle.trim()) return p.contactHandle.trim();
  return p.personaName.split(' ')[0];
}

export function buildSocialLine(labels: string[]): string {
  if (labels.length === 0) return 'Be the first in — don’t wait too long.';
  if (labels.length === 1) return `${labels[0]} is already in.`;
  if (labels.length === 2) return `${labels[0]} & ${labels[1]} are in.`;
  if (labels.length === 3) return `${labels[0]}, ${labels[1]}, and ${labels[2]} are in.`;
  return `${labels[0]}, ${labels[1]}, and ${labels.length - 2} others are in.`;
}
