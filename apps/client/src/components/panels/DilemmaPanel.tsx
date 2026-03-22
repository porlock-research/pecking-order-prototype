import { useGameStore } from '../../store/useGameStore';
import DilemmaCard from '../../cartridges/dilemmas/DilemmaCard';

interface DilemmaPanelProps {
  engine: {
    sendActivityAction: (type: string, payload?: Record<string, any>) => void;
  };
}

export default function DilemmaPanel({ engine }: DilemmaPanelProps) {
  const activeDilemma = useGameStore(s => s.activeDilemma);

  if (!activeDilemma) return null;

  return <DilemmaCard engine={engine} />;
}
