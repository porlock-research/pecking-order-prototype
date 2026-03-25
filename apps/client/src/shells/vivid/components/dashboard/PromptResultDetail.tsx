import React from 'react';
import { ACTIVITY_TYPE_INFO } from '@pecking-order/shared-types';
import type { PromptType } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../../../components/PersonaAvatar';
import { useGameStore } from '../../../../store/useGameStore';
import { SelfHighlight, SelfHighlightLabel } from './SelfHighlight';

interface RosterEntry {
  personaName: string;
  avatarUrl?: string;
  status?: string;
}

interface PromptResult {
  promptType: string;
  promptText?: string;
  silverRewards?: Record<string, number>;
  participantCount?: number;
  playerResponses?: Record<string, string> | null;
  results?: any;
}

interface PromptResultDetailProps {
  result: PromptResult;
  roster?: Record<string, RosterEntry>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

const PROMPT_COLOR = '#8B6CC1';

function resolveResponseText(
  pid: string,
  response: string,
  promptType: string,
  result: PromptResult,
  getName: (pid: string) => string,
): string {
  switch (promptType) {
    case 'WOULD_YOU_RATHER': {
      const optionA = result.results?.optionA ?? 'Option A';
      const optionB = result.results?.optionB ?? 'Option B';
      return response === 'A' ? optionA : response === 'B' ? optionB : response;
    }
    case 'HOT_TAKE':
      return response === 'AGREE' ? 'Agree' : response === 'DISAGREE' ? 'Disagree' : response;
    case 'PLAYER_PICK':
    case 'PREDICTION':
      // response is a playerId — resolve to name
      return getName(response);
    default:
      return response;
  }
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

export function PromptResultDetail({ result, roster }: PromptResultDetailProps) {
  const playerId = useGameStore((s) => s.playerId);
  const getName = (pid: string) => roster?.[pid]?.personaName ?? pid;
  const getAvatar = (pid: string) => roster?.[pid]?.avatarUrl;

  const promptType = result.promptType as PromptType;
  const info = ACTIVITY_TYPE_INFO[promptType];
  const rewards: Record<string, number> = result.silverRewards ?? {};
  const participantCount = result.participantCount ?? 0;
  const totalPlayers = roster ? Object.keys(roster).length : participantCount;

  // Self silver
  const selfReward = playerId ? rewards[playerId] : undefined;
  const selfResponse = playerId && result.playerResponses ? result.playerResponses[playerId] : undefined;

  // Anonymous confessions
  const anonymousConfessions: { index: number; text: string }[] =
    result.results?.anonymousConfessions ?? [];
  const isAnonymous = promptType === 'CONFESSION' || promptType === 'GUESS_WHO';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Activity header */}
      {info && (
        <div style={{ marginBottom: 2 }}>
          <div style={{
            fontFamily: 'var(--vivid-font-display)',
            fontSize: 11,
            fontWeight: 800,
            color: PROMPT_COLOR,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            {info.name}
          </div>
          <div style={{
            fontFamily: 'var(--vivid-font-body)',
            fontSize: 11,
            color: '#9B8E7E',
            marginTop: 2,
            lineHeight: 1.4,
          }}>
            {info.description}
          </div>
        </div>
      )}

      {/* Prompt text */}
      {result.promptText && (
        <div style={{
          padding: '10px 12px',
          borderRadius: 10,
          background: `${PROMPT_COLOR}08`,
          borderLeft: `3px solid ${PROMPT_COLOR}40`,
        }}>
          <p style={{
            margin: 0,
            fontFamily: 'var(--vivid-font-body)',
            fontSize: 13,
            lineHeight: 1.5,
            color: '#3D2E1F',
            fontStyle: 'italic',
          }}>
            &ldquo;{result.promptText}&rdquo;
          </p>
        </div>
      )}

      {/* Player responses (attributed) */}
      {result.playerResponses && !isAnonymous && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Object.entries(result.playerResponses).map(([pid, response]) => {
            const isSelf = pid === playerId;
            const displayText = resolveResponseText(pid, response, promptType, result, getName);
            return (
              <div key={pid} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 0',
              }}>
                <PersonaAvatar
                  avatarUrl={getAvatar(pid)}
                  personaName={getName(pid)}
                  size={22}
                />
                <span style={{
                  fontFamily: 'var(--vivid-font-display)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#3D2E1F',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  maxWidth: 90,
                }}>
                  {getName(pid)}
                </span>
                {isSelf && (
                  <span style={{
                    fontFamily: 'var(--vivid-font-display)',
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#7B5DAF',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    flexShrink: 0,
                  }}>
                    (you)
                  </span>
                )}
                <span style={{
                  fontFamily: 'var(--vivid-font-body)',
                  fontSize: 12,
                  color: '#7A6E60',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {displayText}
                </span>
                {rewards[pid] != null && rewards[pid] > 0 && (
                  <span style={{
                    fontFamily: 'var(--vivid-font-mono)',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#B8840A',
                    flexShrink: 0,
                  }}>
                    +{rewards[pid]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Anonymous confessions */}
      {isAnonymous && anonymousConfessions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {anonymousConfessions.map((confession, i) => (
            <div key={confession.index ?? i} style={{
              padding: '8px 10px',
              borderRadius: 8,
              background: 'rgba(139, 108, 193, 0.04)',
              border: '1px solid rgba(139, 108, 193, 0.08)',
            }}>
              <p style={{
                margin: 0,
                fontFamily: 'var(--vivid-font-body)',
                fontSize: 12,
                lineHeight: 1.5,
                color: '#3D2E1F',
                fontStyle: 'italic',
              }}>
                &ldquo;{confession.text}&rdquo;
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Participation count */}
      <div style={{
        fontFamily: 'var(--vivid-font-display)',
        fontSize: 10,
        fontWeight: 700,
        color: '#9B8E7E',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        {participantCount} of {totalPlayers} player{totalPlayers !== 1 ? 's' : ''} participated
      </div>

      {/* Self-highlight */}
      {playerId && (
        <SelfHighlight>
          {selfReward != null && selfReward > 0 ? (
            <>
              You earned <SelfHighlightLabel>{selfReward} silver</SelfHighlightLabel>.
            </>
          ) : selfResponse !== undefined ? (
            <>You participated.</>
          ) : null}
        </SelfHighlight>
      )}
    </div>
  );
}
