/**
 * Curated pool of divisive, family-friendly hot-take questions.
 * Each entry carries its own 2–4 mutually-exclusive response options.
 * See spec: docs/superpowers/specs/2026-04-17-hot-take-question-pool-design.md
 */

export interface HotTakeQuestion {
  /** Short stable slug (kebab-case). Used for dedupe within a game. */
  id: string;
  /** One-sentence claim (≤100 chars). */
  statement: string;
  /** 2–4 mutually-exclusive stance labels (≤24 chars each). */
  options: string[];
}

export const HOT_TAKE_POOL: HotTakeQuestion[] = [
  { id: 'cereal-before-milk',   statement: 'Cereal should go in the bowl before milk.',          options: ['Cereal first', 'Milk first', 'Wet cereal is wrong', "I don't do cereal"] },
  { id: 'last-page-first',      statement: 'Reading the last page first is a crime.',            options: ['Major crime', 'Totally fine', 'Only for mysteries'] },
  { id: 'k-reply',              statement: 'Replying just "k" is basically hostile.',            options: ['Always hostile', 'Totally neutral', 'Depends on who'] },
  { id: 'ghosting-early',       statement: 'Ghosting is fine if you barely know someone.',       options: ['Fine', 'Never fine', 'Online only'] },
  { id: 'long-voice-memos',     statement: 'Voice memos over thirty seconds are a red flag.',    options: ['Red flag', 'Love them', 'Depends on sender'] },
  { id: 'crocs-shoes',          statement: 'Crocs count as real shoes in public.',               options: ['Yes', 'No', 'Only in Croc Mode'] },
  { id: 'phones-at-dinner',     statement: "Phones don't belong at the dinner table.",           options: ['Hard rule', 'Harmless', 'Only at family dinners'] },
  { id: 'on-time-means-early',  statement: 'Being "on time" means five minutes early.',          options: ['Five early', 'Exactly on time', 'Five late counts'] },
  { id: 'liking-own-posts',     statement: 'Liking your own posts is cringe.',                   options: ['Cringe', 'Confident', 'Only on stories'] },
  { id: 'crying-at-school',     statement: 'Crying at school is always OK.',                     options: ['Always fine', 'Never fine', 'Only in private'] },
  { id: 'small-talk',           statement: 'Small talk is a survival skill, not a waste.',       options: ['Survival skill', 'Waste of breath', 'Depends on the room'] },
  { id: 'cats-vs-dogs',         statement: 'Cats are better than dogs.',                         options: ['Cats', 'Dogs'] },
  { id: 'dogs-on-bed',          statement: 'Dogs on the bed is a dealbreaker.',                  options: ['Dealbreaker', 'Hard yes', 'Small dogs only'] },
  { id: 'ban-homework',         statement: 'Homework should be banned entirely.',                options: ['Ban it', 'Keep it', 'Only for younger grades'] },
  { id: 'uniforms-vs-free',     statement: 'Uniforms are better than free dress.',               options: ['Uniforms', 'Free dress'] },
  { id: 'group-projects',       statement: 'Group projects teach resentment, not teamwork.',     options: ['Facts', "They're valuable", 'Depends on the group'] },
  { id: 'winter-vs-summer',     statement: 'Winter is better than summer.',                      options: ['Winter', 'Summer'] },
  { id: 'ocean-is-scary',       statement: 'The ocean is genuinely terrifying.',                 options: ['Terrifying', 'Calming', 'Only the deep stuff'] },
  { id: 'leftovers-better',     statement: 'Leftovers taste better than the first night.',       options: ['Always', 'Never', 'Only some foods'] },
  { id: 'night-showers',        statement: 'Night showers beat morning showers.',                options: ['Night', 'Morning', 'Both, always'] },
  { id: 'chat-size-limit',      statement: 'Group chats over eight people are always chaos.',    options: ['Nuke them', "Size doesn't matter", 'Depends on the group'] },
  { id: 'playback-speed',       statement: 'Watching a show on 1.5x speed ruins it.',            options: ['Ruins it', 'More efficient', 'Only on rewatch', 'Depends on show'] },
  { id: 'spoilers-fine',        statement: "Spoilers genuinely don't ruin anything.",            options: ['Fine', 'They ruin it', 'Depends on the story'] },
  { id: 'theater-phones',       statement: 'Phones in a movie theater should be illegal.',       options: ['Enforce it', 'Live and let live', 'Only during the movie'] },
  { id: 'early-vs-late',        statement: 'Being really early is worse than being slightly late.', options: ['Worse', 'Always better', 'Depends on the event'] },
  { id: 'socks-and-sandals',    statement: 'Socks with sandals deserves respect.',               options: ['Respect the move', 'Never OK', 'Only in winter'] },
  { id: 'birthdays-after-21',   statement: 'Birthdays stop being a big deal after twenty-one.',  options: ['Agreed', 'Every one counts', 'Only round numbers'] },
  { id: 'solo-restaurant',      statement: 'Eating alone at a restaurant is underrated.',        options: ['Underrated', 'Depressing', 'Only at the bar'] },
  { id: 'pen-vs-pencil',        statement: 'Writing in pen is better than pencil.',              options: ['Pen', 'Pencil', 'Depends on the task'] },
  { id: 'text-vs-call',         statement: 'A short call beats a long text thread.',             options: ['Agreed', 'Hard disagree', 'Depends on the topic'] },
];

/**
 * Pick a random hot take the current game hasn't used yet.
 * When every id in the pool has been used, reset and pick from the full pool.
 */
export function pickHotTakeQuestion(usedIds: readonly string[]): HotTakeQuestion {
  const used = new Set(usedIds);
  const available = HOT_TAKE_POOL.filter((q) => !used.has(q.id));
  const pool = available.length > 0 ? available : HOT_TAKE_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}
