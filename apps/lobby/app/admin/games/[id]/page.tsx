'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { getGameState, getGameDetails, sendAdminCommand, flushScheduledTasks, getScheduledTasks } from '../../../actions';
import { useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { OverviewTab } from './_tabs/OverviewTab';
import { TimelineTab } from './_tabs/TimelineTab';
import { GmChatTab } from './_tabs/GmChatTab';
import { JournalTab } from './_tabs/JournalTab';
import { InspectorTab } from './_tabs/InspectorTab';
import { RawStateTab } from './_tabs/RawStateTab';

const TAB_LIST = [
  { value: 'overview', label: 'Overview' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'gm-chat', label: 'GM Chat' },
  { value: 'journal', label: 'Journal' },
  { value: 'inspector', label: 'Inspector' },
  { value: 'raw', label: 'Raw State' },
];

export default function GameDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const gameId = params.id as string;
  const initialTab = searchParams.get('tab') || 'overview';

  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [clientHost, setClientHost] = useState<string | null>(null);
  const [scheduledTasks, setScheduledTasks] = useState<any>(null);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const detailsFetched = useRef(false);

  async function refreshTasks() {
    setTasksLoading(true);
    const data = await getScheduledTasks(gameId);
    setScheduledTasks(data);
    setTasksLoading(false);
  }

  async function refresh() {
    setLoading(true);
    // Game details (invite code, client host) are static — only fetch once
    if (!detailsFetched.current) {
      const [data, details] = await Promise.all([
        getGameState(gameId),
        getGameDetails(gameId),
      ]);
      setState(data);
      setInviteCode(details.inviteCode);
      setClientHost(details.clientHost);
      detailsFetched.current = true;
    } else {
      const data = await getGameState(gameId);
      setState(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    detailsFetched.current = false;
    refresh().then(() => {
      if (initialTab === 'timeline') refreshTasks();
    });
  }, [gameId]);

  async function handleCommand(cmd: any) {
    await sendAdminCommand(gameId, cmd);
    setTimeout(refresh, 500);
  }

  async function handleSendGmMessage(message: string, targetId?: string) {
    await sendAdminCommand(gameId, {
      type: 'SEND_GAME_MASTER_MSG',
      content: message,
      ...(targetId ? { targetId } : {}),
    });
  }

  async function handleFlushTasks() {
    await flushScheduledTasks(gameId);
    refreshTasks();
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    if (tab === 'timeline' && !scheduledTasks) refreshTasks();
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    router.replace(url.pathname + url.search, { scroll: false });
  }

  if (loading && !state) {
    return <div className="py-12 text-center text-muted-foreground">Loading game state...</div>;
  }

  if (state?.error) {
    return <div className="py-12 text-center text-destructive">Error: {state.error}</div>;
  }

  if (!state) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {inviteCode ?? gameId}
          </h1>
          {inviteCode && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{gameId}</p>
          )}
          <div className="flex gap-2 mt-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Day {state.day}
            </Badge>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              {typeof state.state === 'string' ? state.state : JSON.stringify(state.state)}
            </Badge>
            {(state.manifest?.scheduling || state.manifest?.gameMode) && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
                {state.manifest?.scheduling || state.manifest?.gameMode}
              </Badge>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          {TAB_LIST.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab
            state={state}
            gameId={gameId}
            inviteCode={inviteCode}
            clientHost={clientHost}
            onCommand={handleCommand}
            onFlushAlarms={handleFlushTasks}
          />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <TimelineTab
            state={state}
            scheduledTasks={scheduledTasks}
            tasksLoading={tasksLoading}
            onRefreshTasks={refreshTasks}
            onFlushTasks={handleFlushTasks}
            onCommand={handleCommand}
          />
        </TabsContent>

        <TabsContent value="gm-chat" className="mt-4">
          <GmChatTab
            state={state}
            gameId={gameId}
            onSendMessage={handleSendGmMessage}
          />
        </TabsContent>

        <TabsContent value="journal" className="mt-4">
          <JournalTab gameId={gameId} state={state} />
        </TabsContent>

        <TabsContent value="inspector" className="mt-4">
          <InspectorTab gameId={gameId} />
        </TabsContent>

        <TabsContent value="raw" className="mt-4">
          <RawStateTab state={state} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
