import React from 'react';
import { CartridgeProps } from '@pecking-order/shared-types';

const Trivia: React.FC<CartridgeProps> = ({ stage, payload, onAction }) => {
  return (
    <div className="cartridge trivia">
      <h3>Trivia: {stage}</h3>
      <div className="content">
        {stage === 'PLAY' && (
          <button onClick={() => onAction({ type: 'TRIVIA.SUBMIT', answer: 'A' })}>
            Choose Option A
          </button>
        )}
      </div>
      <style>{`
        .trivia { padding: 1rem; background: #2c3e50; border-radius: 8px; }
      `}</style>
    </div>
  );
};

export default Trivia;
