import React from 'react';
import VotingPanel from '../panels/VotingPanel';
import GamePanel from '../panels/GamePanel';
import PromptPanel from '../panels/PromptPanel';
import type { TimelineEntry } from './types';

interface TimelineCartridgeCardProps {
  entry: Extract<TimelineEntry, { kind: 'voting' | 'game' | 'prompt' }>;
  engine: any;
}

export const TimelineCartridgeCard: React.FC<TimelineCartridgeCardProps> = ({ entry, engine }) => {
  switch (entry.kind) {
    case 'voting':
      return <VotingPanel engine={engine} />;
    case 'game':
      return <GamePanel engine={engine} />;
    case 'prompt':
      return <PromptPanel engine={engine} />;
  }
};
