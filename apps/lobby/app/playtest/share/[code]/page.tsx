import { getEnv } from '@/lib/db';
import { SharePageClient } from './client';

export default async function SharePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const [{ code }, env] = await Promise.all([params, getEnv()]);
  const lobbyHost = (env.LOBBY_HOST as string) || '';
  const playtestUrl = (env.PLAYTEST_URL as string) || `${lobbyHost}/playtest`;

  return <SharePageClient code={code} playtestUrl={playtestUrl} />;
}
