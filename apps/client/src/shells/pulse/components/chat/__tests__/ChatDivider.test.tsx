import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatDivider } from '../ChatDivider';

class MockIO {
  static instances: MockIO[] = [];
  callback: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
    MockIO.instances.push(this);
  }
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = '';
  thresholds: ReadonlyArray<number> = [];
  triggerExit() {
    this.callback(
      [{ isIntersecting: false, boundingClientRect: { top: -10 } } as any],
      this as any,
    );
  }
}

beforeEach(() => {
  MockIO.instances = [];
  (global as any).IntersectionObserver = MockIO;
});

describe('ChatDivider', () => {
  it('renders a "New" label', () => {
    render(<ChatDivider onCleared={vi.fn()} />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('fires onCleared when IntersectionObserver reports top-exit', () => {
    const onCleared = vi.fn();
    render(<ChatDivider onCleared={onCleared} />);
    expect(MockIO.instances.length).toBe(1);
    MockIO.instances[0].triggerExit();
    expect(onCleared).toHaveBeenCalled();
  });
});
