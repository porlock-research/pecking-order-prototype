/**
 * Channel placeholder hint builder — shell-agnostic.
 * Returns an array of placeholder strings for a given channel context.
 * The client cycles through these as placeholder text in the chat input.
 */
import type { ChannelType, ChannelCapability, DayPhase } from './index';
import { DayPhases } from './index';

export function getChannelHints(
  channelType: ChannelType,
  params?: {
    targetName?: string;
    capabilities?: ChannelCapability[];
    phase?: DayPhase;
  },
): string[] {
  const hints: string[] = [];
  const name = params?.targetName ?? 'them';
  const caps = params?.capabilities ?? [];
  const phase = params?.phase;

  // Phase-specific hints (highest priority — shown first)
  if (phase === DayPhases.VOTING) {
    hints.push('Quick, before votes close...');
  }
  if (phase === DayPhases.GAME) {
    hints.push('Talk strategy...');
  }

  // Channel type base hints
  switch (channelType) {
    case 'DM':
      hints.push(
        `Whisper to ${name}...`,
        'Make a deal...',
        'Form an alliance...',
      );
      break;
    case 'GROUP_DM':
      hints.push(
        'Message the group...',
        'Invite someone new...',
        'Strategize together...',
      );
      break;
    case 'GAME_DM':
      hints.push(
        'Message your partner...',
        'Coordinate your move...',
      );
      break;
    case 'MAIN':
    default:
      hints.push(
        'Plot your next move...',
        'Make your case...',
        'Address the house...',
      );
      break;
  }

  // Capability hints
  if (caps.includes('SILVER_TRANSFER')) {
    hints.push('Send silver using $ below');
  }
  if (caps.includes('INVITE_MEMBER')) {
    hints.push('Invite players into this chat');
  }

  return hints;
}
