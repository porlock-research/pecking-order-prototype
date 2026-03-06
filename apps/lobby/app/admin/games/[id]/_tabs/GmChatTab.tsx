'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface GmChatTabProps {
  state: any;
  gameId: string;
  onSendMessage: (message: string, targetId?: string) => Promise<void>;
}

export function GmChatTab({ state, onSendMessage }: GmChatTabProps) {
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('');
  const [sending, setSending] = useState(false);

  const roster: Record<string, any> = state.roster || {};
  const rosterEntries = Object.entries(roster);

  async function handleSend(targetId?: string) {
    if (!message.trim()) return;
    setSending(true);
    await onSendMessage(message.trim(), targetId);
    setMessage('');
    setSending(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Game Master Chat</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a game master message..."
          rows={3}
        />

        <div className="flex gap-3 items-end flex-wrap">
          <Button
            onClick={() => handleSend()}
            disabled={!message.trim() || sending}
          >
            {sending ? 'Sending...' : 'Send to Group'}
          </Button>

          {rosterEntries.length > 0 && (
            <>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select player..." />
                </SelectTrigger>
                <SelectContent>
                  {rosterEntries.map(([id, p]) => (
                    <SelectItem key={id} value={id}>
                      {p.personaName} ({id}) {p.status === 'ELIMINATED' ? '[X]' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="secondary"
                onClick={() => { if (target) handleSend(target); }}
                disabled={!message.trim() || !target || sending}
              >
                Send DM
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
