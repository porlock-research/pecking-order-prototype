interface Props { isGroup: boolean; targetName: string; groupNames?: string; }

export function DmEmptyState({ isGroup, targetName, groupNames }: Props) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, textAlign: 'center',
    }}>
      <div style={{
        fontStyle: 'italic', fontSize: 13, color: 'var(--pulse-text-3)', lineHeight: 1.5, maxWidth: 280,
      }}>
        {isGroup
          ? <>Your group with {groupNames}. No messages yet. Say something to get it started.</>
          : <>No messages yet with {targetName}. Break the ice.</>
        }
      </div>
    </div>
  );
}
