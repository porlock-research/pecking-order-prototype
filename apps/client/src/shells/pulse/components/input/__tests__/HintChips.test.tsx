import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HintChips } from '../HintChips';

describe('HintChips visibility', () => {
  const noop = () => {};

  it('MAIN shows /silver /nudge /whisper /dm and @mention', () => {
    render(
      <HintChips
        onSelect={noop}
        channelType="MAIN"
        capabilities={['CHAT', 'REACTIONS', 'SILVER_TRANSFER', 'NUDGE', 'WHISPER']}
      />,
    );
    expect(screen.getByText('/silver')).toBeInTheDocument();
    expect(screen.getByText('/nudge')).toBeInTheDocument();
    expect(screen.getByText('/whisper')).toBeInTheDocument();
    expect(screen.getByText('/dm')).toBeInTheDocument();
    expect(screen.getByText('@mention')).toBeInTheDocument();
  });

  it('1:1 DM shows /silver /nudge only', () => {
    render(
      <HintChips
        onSelect={noop}
        channelType="DM"
        capabilities={['CHAT', 'SILVER_TRANSFER', 'INVITE_MEMBER', 'NUDGE']}
      />,
    );
    expect(screen.getByText('/silver')).toBeInTheDocument();
    expect(screen.getByText('/nudge')).toBeInTheDocument();
    expect(screen.queryByText('/whisper')).toBeNull();
    expect(screen.queryByText('/dm')).toBeNull();
    expect(screen.queryByText('@mention')).toBeNull();
  });

  it('GROUP_DM shows /silver and @mention', () => {
    render(
      <HintChips
        onSelect={noop}
        channelType="GROUP_DM"
        capabilities={['CHAT', 'SILVER_TRANSFER', 'INVITE_MEMBER']}
      />,
    );
    expect(screen.getByText('/silver')).toBeInTheDocument();
    expect(screen.getByText('@mention')).toBeInTheDocument();
    expect(screen.queryByText('/nudge')).toBeNull();
  });

  it('GAME_DM with no caps renders nothing', () => {
    const { container } = render(
      <HintChips onSelect={noop} channelType="GAME_DM" capabilities={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
