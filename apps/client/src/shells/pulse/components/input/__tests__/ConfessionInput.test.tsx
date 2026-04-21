import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConfessionInput } from '../ConfessionInput';

describe('ConfessionInput', () => {
  it('renders the "Speak into the mic…" placeholder', () => {
    render(<ConfessionInput myHandle="Confessor #3" onSend={() => {}} />);
    expect(screen.getByPlaceholderText(/speak into the mic/i)).toBeInTheDocument();
  });

  it('shows the assigned handle on a tape label', () => {
    render(<ConfessionInput myHandle="Confessor #3" onSend={() => {}} />);
    expect(screen.getByText(/confessor · 3/i)).toBeInTheDocument();
  });

  it('character counter shows 0 / 280 when empty', () => {
    render(<ConfessionInput myHandle="Confessor #3" onSend={() => {}} />);
    expect(screen.getByText('0 / 280')).toBeInTheDocument();
  });

  it('character counter updates as user types', () => {
    render(<ConfessionInput myHandle="Confessor #3" onSend={() => {}} />);
    const input = screen.getByPlaceholderText(/speak into the mic/i);
    fireEvent.change(input, { target: { value: 'hello' } });
    expect(screen.getByText('5 / 280')).toBeInTheDocument();
  });

  it('GO ON AIR button disables past 280 chars', () => {
    render(<ConfessionInput myHandle="Confessor #3" onSend={() => {}} />);
    const input = screen.getByPlaceholderText(/speak into the mic/i);
    fireEvent.change(input, { target: { value: 'a'.repeat(281) } });
    expect(screen.getByRole('button', { name: /go on air/i })).toBeDisabled();
  });

  it('GO ON AIR button disabled when empty', () => {
    render(<ConfessionInput myHandle="Confessor #3" onSend={() => {}} />);
    expect(screen.getByRole('button', { name: /go on air/i })).toBeDisabled();
  });

  it('GO ON AIR enabled at exactly 280 chars', () => {
    render(<ConfessionInput myHandle="Confessor #3" onSend={() => {}} />);
    const input = screen.getByPlaceholderText(/speak into the mic/i);
    fireEvent.change(input, { target: { value: 'a'.repeat(280) } });
    expect(screen.getByRole('button', { name: /go on air/i })).not.toBeDisabled();
  });

  it('send calls onSend with text and clears the input', () => {
    const onSend = vi.fn();
    render(<ConfessionInput myHandle="Confessor #3" onSend={onSend} />);
    const input = screen.getByPlaceholderText(/speak into the mic/i) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'the truth is' } });
    fireEvent.click(screen.getByRole('button', { name: /go on air/i }));
    expect(onSend).toHaveBeenCalledWith('the truth is');
    expect(input.value).toBe('');
  });

  it('renders "locked out" plate when myHandle is null (non-member)', () => {
    render(<ConfessionInput myHandle={null} onSend={() => {}} />);
    expect(screen.queryByPlaceholderText(/speak into the mic/i)).toBeNull();
    expect(screen.getByText(/booth isn.?t yours/i)).toBeInTheDocument();
  });

  it('trims whitespace before sending; blank input does not fire', () => {
    const onSend = vi.fn();
    render(<ConfessionInput myHandle="Confessor #3" onSend={onSend} />);
    const input = screen.getByPlaceholderText(/speak into the mic/i);
    fireEvent.change(input, { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: /go on air/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /go on air/i }));
    expect(onSend).not.toHaveBeenCalled();
  });
});
