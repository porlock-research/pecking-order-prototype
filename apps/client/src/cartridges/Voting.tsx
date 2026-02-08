import React from 'react';
import { CartridgeProps } from '@pecking-order/shared-types';

const Voting: React.FC<CartridgeProps> = ({ stage, payload, onAction }) => {
  return (
    <div className="cartridge voting">
      <h3>Voting: {stage}</h3>
      <div className="content">
        {stage === 'PLAY' && (
          <button onClick={() => onAction({ type: 'VOTE.CAST', target: 'someone' })}>
            Cast Vote
          </button>
        )}
      </div>
      <style>{`
        .voting { padding: 1rem; background: #c0392b; border-radius: 8px; }
      `}</style>
    </div>
  );
};

export default Voting;
