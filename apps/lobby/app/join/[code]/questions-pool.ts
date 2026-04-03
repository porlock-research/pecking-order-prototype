import type { QaEntry } from '@pecking-order/shared-types';

// ── Types ──

export interface QuestionDef {
  id: string;
  text: string;
  /** If set, only shown to this persona */
  forPersonaId?: string;
  /** Default answers (used when no persona-specific override exists) */
  defaultAnswers: string[];
  /** Persona-specific answer overrides (personaId -> up to 3 answers) */
  personaAnswers?: Record<string, string[]>;
  /** GM narrator lead-in template. Placeholders: {name}, {stereotype}, {description} */
  narratorIntro: string;
}

export interface QuestionWithOptions {
  id: string;
  text: string;
  options: string[]; // exactly 3 pre-generated options
}

export interface QaSubmission {
  questionId: string;
  selectedIndex: number; // 0-2 = pre-generated, 3 = custom
  customAnswer?: string;
}

// ── Question Pool ──
// Generic questions + persona-specific answer overrides.
// Persona-specific questions use forPersonaId.
// Bio-derived — answers reference each persona's description text.

export const QUESTION_POOL: QuestionDef[] = [
  // --- Generic questions ---
  {
    id: 'q-morning-routine',
    text: "What's your morning routine?",
    narratorIntro: `'{name} — {stereotype}. {description} The Game Master wanted to know: what do they do when the sun comes up?'`,
    defaultAnswers: ['5am alarm, no snooze', 'Coffee first, existence second', 'What morning? I wake up at noon'],
    personaAnswers: {
      'persona-05': ['50 pushups before the alarm', 'Protein shake and a mirror pep talk', 'Shadow boxing my reflection'],
      'persona-01': ['Golden hour selfie session', 'Check overnight follower growth', 'Manifest success for 20 minutes'],
      'persona-22': ['Stare at the ceiling until noon', 'Black coffee, blacker mood', 'Journal my existential dread'],
      'persona-11': ['0500 sharp, make the bed with hospital corners', 'PT at dawn, no excuses', 'Inspect the perimeter'],
      'persona-27': ['Perimeter check, then inventory ammo', 'Filter my own rainwater', 'Practice my bug-out route'],
      'persona-28': ['Affirmations in the mirror for 40 minutes', 'Manifest abundance and hydrate', 'Journal five things I am grateful for'],
      'persona-34': ['Photosynthesize in the backyard', 'Spirulina smoothie and a lecture', 'Scream at the sun for energy'],
      'persona-38': ['Check my horoscope before I open my eyes', 'Align my chakras with the moon phase', 'Burn sage over the coffee maker'],
      'persona-48': ['7am standup with myself', 'Review my personal KPIs', 'Block out synergy time on the calendar'],
    },
  },
  {
    id: 'q-allergies',
    text: 'Do you have any allergies?',
    narratorIntro: `'The Game Master had a medical concern. {name}, {stereotype} — {description} So... any allergies?'`,
    defaultAnswers: ['Dust', 'Responsibility', 'Morning people'],
    personaAnswers: {
      'persona-22': ['Sunlight', 'Happiness', 'Optimism'],
      'persona-16': ['Rest days', 'Skipping leg day', 'Carbs'],
      'persona-13': ['Analog technology', 'Work-life balance', 'Meetings that could be emails'],
      'persona-33': ['Dust, pollen, gluten, and hope', 'Studio lighting apparently', 'Everything on WebMD'],
      'persona-34': ['Dairy, meat, eggs, honey, leather, wool', 'The mere scent of cheese', 'People who say "a little butter is fine"'],
      'persona-31': ['Dogs, obviously', 'Anything my cats are allergic to', 'People who dislike cats'],
      'persona-45': ['Instant coffee', 'Pre-packaged anything', 'The concept of a microwave'],
    },
  },
  {
    id: 'q-hidden-talent',
    text: "What's your hidden talent?",
    narratorIntro: `'Every player hides something. {name}, {stereotype}, is no exception. {description} But what is their hidden talent?'`,
    defaultAnswers: ['Sleeping anywhere', 'Remembering useless facts', 'Accidentally starting drama'],
    personaAnswers: {
      'persona-12': ['Painting with non-traditional fluids', 'Communicating with houseplants', 'Crying in exactly 7 art styles'],
      'persona-15': ['Reading people like open books', 'Counting cards while making eye contact', 'Winning at games I never played'],
      'persona-05': ['Bench pressing other contestants', 'Crying in a manly way', 'Giving motivational speeches nobody asked for'],
      'persona-29': ['Making a dove appear from thin air', 'Card tricks that almost work', 'Sawing tension in half'],
      'persona-25': ['Becoming someone else entirely', 'Method acting my way through conflict', 'Staying in character while unconscious'],
      'persona-40': ['Finding the flaw in any argument', 'Mental math under pressure', 'Spreadsheets that predict betrayal'],
      'persona-44': ['Narrating real life like a novel', 'Dramatic internal monologues out loud', 'Making anything sound romantic'],
    },
  },
  {
    id: 'q-biggest-red-flag',
    text: "What's your biggest red flag?",
    narratorIntro: `'The Game Master pressed {name} for their biggest red flag. {stereotype} — {description} The answer did not disappoint.'`,
    defaultAnswers: ['I never text back', 'I always think I am right', 'I google people before meeting them'],
    personaAnswers: {
      'persona-04': ['I enjoy betraying people', 'I keep a mental file on everyone', 'My compliments are always tactical'],
      'persona-02': ['I fall in love every 48 hours', 'I flex in every reflective surface', 'I have cried at 3 reality shows this week'],
      'persona-09': ['I need to know everyones secret', 'I pretend to be your friend first', 'Knowledge is power and I am a nuclear plant'],
      'persona-25': ['I might not be who you think I am', 'I stay in character during arguments', 'You will never know the real me'],
      'persona-42': ['I am only here for revenge', 'I hold grudges professionally', 'My ex is somewhere in this game'],
      'persona-47': ['I will diagnose you without consent', 'I carry a clipboard everywhere', 'I trace everything back to your mother'],
      'persona-32': ['I will try to sell you something', 'My compliments are always a sales pitch', 'I see everyone as a potential downline'],
      'persona-39': ['I overshare within five seconds', 'I will tell you my medical history', 'Boundaries are just suggestions to me'],
      'persona-33': ['I self-diagnose hourly', 'I think everything is a symptom', 'I bring hand sanitizer to handshakes'],
      'persona-44': ['I narrate everything out loud', 'I romanticize the mundane aggressively', 'I describe people like novel characters'],
      'persona-30': ['I freestyle at inappropriate times', 'My rhymes are objectively terrible', 'I will try to drop my mixtape on you'],
    },
  },
  {
    id: 'q-comfort-food',
    text: "What's your comfort food?",
    narratorIntro: `'{description} But even {name}, {stereotype}, needs comfort sometimes. The Game Master asked about their go-to comfort food.'`,
    defaultAnswers: ['Pizza at 2am', 'Whatever is closest', 'I do not eat for comfort, I eat for fuel'],
    personaAnswers: {
      'persona-20': ['My award-winning brisket', 'Anything off my grill', 'Whatever I can cook better than you'],
      'persona-22': ['Black coffee and silence', 'Anything eaten alone in the dark', 'Sadness soup'],
      'persona-08': ['A single grain of rice, mindfully', 'Whatever the universe provides', 'Tea and enlightenment'],
      'persona-26': ['Wagyu flown in from Kobe', 'My personal chef makes it better', 'Does this house have truffle oil?'],
      'persona-45': ['A deconstructed ratatouille', 'Bone broth simmered for 72 hours', 'Whatever I forage from the yard'],
      'persona-46': ['Whatever is free', 'Stolen hotel breakfast buffet rolls', 'Ketchup packets from the drawer'],
      'persona-34': ['Raw cashew cheese on flax crackers', 'A smoothie bowl that judges you', 'Nothing with a face or a mother'],
    },
  },
  {
    id: 'q-theme-song',
    text: "What's your theme song?",
    narratorIntro: `'If {name} had a theme song, what would it be? {stereotype} — {description} The Game Master had to ask.'`,
    defaultAnswers: ['Something with a beat drop', 'Elevator music ironically', 'I walk in silence'],
    personaAnswers: {
      'persona-23': ['"Eye of the Tiger" obviously', 'My own show intro theme', 'Something with explosions'],
      'persona-19': ['The bass-boosted version of anything', 'Whatever the DJ is playing', 'My theme song IS the party'],
      'persona-11': ['Military drums', 'Reveille at 0500', 'The national anthem, standing'],
      'persona-30': ['My own unreleased single obviously', 'A beat I freestyled in confessional', 'Something with heavy bass and bad rhymes'],
      'persona-49': ['A five-minute acoustic ballad I wrote', 'Something on guitar, give me a sec', 'An original indie-folk piece about toast'],
      'persona-43': ['A dramatic orchestral swell', 'Whatever plays during a slap scene', 'My telenovela intro theme'],
      'persona-36': ['My cereal commercial jingle from age 9', 'Something nostalgic and a little sad', 'The theme from my cancelled sitcom'],
      'persona-45': ['A French waltz played on a wine glass', 'The sound of a souffle rising', 'Something with truffle undertones'],
      'persona-33': ['A hospital monitor beep, basically', 'Something calming for my nerves', 'Anything without allergens in the lyrics'],
      'persona-46': ['Whatever is royalty-free', 'I hum because music costs money', 'The sound of coins being saved'],
    },
  },
  {
    id: 'q-exit-speech',
    text: 'If you were eliminated first, what would your exit speech be?',
    narratorIntro: `'Nobody wants to go home first. The Game Master asked {name} — {stereotype} — to prepare an exit speech. {description} Here is what they said.'`,
    defaultAnswers: ['No speech, just a slow clap', 'You will all regret this', 'Honestly? Fair enough'],
    personaAnswers: {
      'persona-23': ['"You have not seen the last of me"', '"Check my highlight reel"', '"I have survived 3 shows, I will survive this"'],
      'persona-07': ['*uncontrollable sobbing*', '"I hope you all feel terrible"', '"This is the worst day of my life... again"'],
      'persona-21': ['"I will buy this entire show"', '"My lawyers will be in touch"', '*tips the staff on the way out*'],
      'persona-43': ['*faints dramatically at the podium*', '"You have not seen the last of me" *slap*', '*demands the wind machine one last time*'],
      'persona-37': ['"Honestly I still do not know what this is"', '"Can someone point me to the bathroom?"', '"Wait, there was a prize?"'],
      'persona-36': ['"I was famous before any of you"', '"Google my cereal commercial"', '"My agent will hear about this"'],
      'persona-42': ['"I already got what I came for"', '"This was never about the money"', '*glares at her ex on the way out*'],
    },
  },
  {
    id: 'q-alliance-contribution',
    text: 'What do you bring to an alliance?',
    narratorIntro: `'Alliances win games. The Game Master asked {name} what they bring to the table. {stereotype} — {description}'`,
    defaultAnswers: ['Undying loyalty', 'Strategic genius', 'Comic relief'],
    personaAnswers: {
      'persona-04': ['Information from every side', 'A list of who to backstab next', 'A smile that hides everything'],
      'persona-03': ['A clipboard and a 5-year plan', 'PTA-level organizational skills', 'The look that stops arguments'],
      'persona-18': ['Wisdom you did not ask for', 'Devastating one-liners', 'I have been right about everything so far'],
      'persona-40': ['A risk-adjusted betrayal matrix', 'Printed spreadsheets and a calculator', 'Probability models for every vote'],
      'persona-27': ['A tactical machete and MREs', 'Survival skills for the apocalypse', 'An underground bunker blueprint'],
      'persona-50': ['I match people, not strategies', 'Romantic chemistry analysis', 'Everyone paired up and distracted'],
      'persona-29': ['A card trick to defuse any argument', 'Misdirection and live doves', 'The element of surprise, literally'],
      'persona-42': ['Pure, focused vengeance', 'Intel on my ex and his allies', 'Motivation that never runs out'],
      'persona-45': ['Gourmet meals from foraged ingredients', 'A refined palate and strong opinions', 'Culinary superiority'],
      'persona-46': ['Budgeting and resource hoarding', 'I never waste anything, ever', 'Stolen snacks from every room'],
      'persona-44': ['Dramatic narration of our victories', 'Romantic subplots to boost morale', 'Making us sound legendary'],
      'persona-33': ['Medical knowledge, mostly imaginary', 'Hand sanitizer for the whole team', 'A WebMD diagnosis for every problem'],
      'persona-49': ['An acoustic anthem for the alliance', 'Morale through unsolicited music', 'A guitar and zero self-awareness'],
    },
  },
  {
    id: 'q-first-notice',
    text: "What's the first thing you notice about other players?",
    narratorIntro: `'{name}, {stereotype}, walks into a room and immediately notices one thing. {description} What catches their eye first?'`,
    defaultAnswers: ['Their vibe', 'Whether they seem trustworthy', 'Their shoes, weirdly'],
    personaAnswers: {
      'persona-15': ['Their tells', 'Whether they are lying', 'How easily manipulated they are'],
      'persona-08': ['Their aura', 'Their breathing pattern', 'Whether they have found inner peace'],
      'persona-10': ['Their stats from previous shows', 'Whether they match my fantasy draft', 'Gameplay patterns'],
      'persona-38': ['Their rising sign immediately', 'Aura color and general vibration', 'Whether Mercury explains their energy'],
      'persona-47': ['Signs of unresolved childhood trauma', 'Their attachment style', 'Whether they need a session'],
      'persona-31': ['Whether they are a cat person', 'How many cats they remind me of', 'If my cats would approve of them'],
      'persona-41': ['Their power level', 'If they could be a main character', 'Whether their outfit is cosplay-worthy'],
    },
  },
  {
    id: 'q-keeps-up-at-night',
    text: 'What keeps you up at night?',
    narratorIntro: `'{description} But what keeps {name}, {stereotype}, up at night? The Game Master wanted to know.'`,
    defaultAnswers: ['My phone', 'Overthinking everything I said today', 'Nothing, I sleep like a rock'],
    personaAnswers: {
      'persona-06': ['Theorizing who is really in charge', 'The hidden cameras I have not found yet', 'Shadow government stuff'],
      'persona-10': ['Rewatching old episodes in my head', 'My fantasy draft of all-star players', 'Theorizing who is playing whom'],
      'persona-09': ['Planning my next move', "Cataloging everyone else's weaknesses", 'The thrill of having secrets'],
      'persona-35': ['Ghost noises from the voting booth', 'Unexplained cold spots in the house', 'Entities I cannot fully identify yet'],
      'persona-33': ['My 47 undiagnosed symptoms', 'Whether the pillow has dust mites', 'Googling rashes at 3am'],
      'persona-27': ['Fortifying the bedroom perimeter', 'The inevitable societal collapse', 'Zombie contingency plans'],
      'persona-42': ['Plotting my next move against my ex', 'Rehearsing confrontation speeches', 'The satisfaction of future revenge'],
      'persona-50': ['Couples that should be together', 'Romantic pairings I have not made yet', 'Why nobody appreciates matchmaking'],
      'persona-39': ['Remembering what I overshared today', 'Whether I told that story about my rash', 'The looks on peoples faces earlier'],
      'persona-30': ['Writing bars that still do not rhyme', 'My mixtape that nobody will listen to', 'Whether I should freestyle at breakfast'],
      'persona-46': ['Calculating how much I saved today', 'Whether someone took my hidden snacks', 'The cost of being on this show'],
    },
  },
  {
    id: 'q-million-silver',
    text: 'What would you spend a million silver on?',
    narratorIntro: `'A million silver. The Game Master asked {name} — {stereotype} — how they would spend it. {description}'`,
    defaultAnswers: ["Buy everyone's loyalty", 'Disappear forever', 'Invest it and triple it'],
    personaAnswers: {
      'persona-21': ['That is a rounding error for me', 'A hostile takeover of the game', 'Tip the staff generously'],
      'persona-14': ['Fix the church roof back home', 'Visit the big city for the first time', 'Probably get scammed honestly'],
      'persona-12': ['A gallery showing of my trauma art', 'Every paint color that exists', 'Fund other struggling artists'],
      'persona-26': ['That is barely a rounding error', 'A mid-range watch I suppose', 'One month of yacht maintenance'],
      'persona-46': ['Hide it all under the mattress', 'Coupons still save more honestly', 'Invest in bulk toilet paper futures'],
      'persona-32': ['Scale my essential oils empire', 'Recruit a million-person downline', 'Buy the top tier starter kit'],
    },
  },
  {
    id: 'q-party-trick',
    text: "What's your party trick?",
    narratorIntro: `'Every player needs a party trick. {name}, {stereotype} — {description} What is theirs?'`,
    defaultAnswers: ['Disappearing without saying goodbye', 'Knowing all the lyrics', 'Starting a conga line'],
    personaAnswers: {
      'persona-19': ['I AM the party trick', 'Drinking anything from anything', 'Making strangers best friends in 5 minutes'],
      'persona-17': ['A perfect walk in any heels', 'World peace speech in under 60 seconds', 'Making everyone feel underdressed'],
      'persona-16': ['One-arm pushups', 'Flexing to the beat', 'Opening bottles with my bicep'],
      'persona-29': ['A coin behind your ear, every time', 'Making the host\'s mic disappear', 'Pulling a dove out of my jacket'],
      'persona-39': ['Oversharing until the room goes silent', 'Making strangers deeply uncomfortable', 'A full medical history in 30 seconds'],
      'persona-49': ['An original acoustic song about the party', 'A seven-minute guitar ballad', 'Singing until everyone leaves'],
      'persona-30': ['A freestyle rap about the snack table', 'Dropping bars nobody asked for', 'Beatboxing with zero rhythm'],
    },
  },
  {
    id: 'q-dealbreaker',
    text: "What's your dealbreaker in an alliance partner?",
    narratorIntro: `'The Game Master got personal. What is a dealbreaker for {name}, {stereotype}, in an alliance partner? {description}'`,
    defaultAnswers: ['Being boring', 'Being too honest', 'Being too sneaky'],
    personaAnswers: {
      'persona-11': ['Lack of discipline', 'Showing up late', 'Questioning the chain of command'],
      'persona-01': ['Bad lighting in their selfies', 'Less than 1000 followers', 'No brand synergy'],
      'persona-13': ['Non-scalable thinking', 'Refusing to optimize', 'Still using a flip phone'],
      'persona-48': ['No respect for the org chart', 'Skipping the weekly status update', 'Not reading the meeting agenda'],
      'persona-28': ['Negative self-talk', 'Refusing to grow as a person', 'Not journaling their feelings'],
      'persona-50': ['No romantic chemistry at all', 'Refusing to be set up on a date', 'Bad flirting energy'],
      'persona-40': ['Emotional decision-making', 'Rounding errors in their logic', 'Not showing their work'],
    },
  },
  {
    id: 'q-strategy',
    text: "What's your strategy for winning?",
    narratorIntro: `'{name} is here to win. {stereotype} — {description} The Game Master asked about their strategy.'`,
    defaultAnswers: ["Be everyone's best friend", 'Fly under the radar', 'Win every competition'],
    personaAnswers: {
      'persona-04': ['Make them trust me, then strike', 'Information is currency', 'Everyone is a pawn'],
      'persona-14': ['Just be nice and hope for the best', 'Pray', 'I do not really have one honestly'],
      'persona-08': ['The game wins itself if you let go', 'Non-attachment to outcomes', 'Breathe and be present'],
      'persona-25': ['Become whoever they need me to be', 'Method act my way to the finale', 'Nobody knows my real strategy'],
      'persona-40': ['A 47-row spreadsheet I printed out', 'Statistical modeling of every outcome', 'Minimize risk, maximize betrayal ROI'],
      'persona-35': ['Consult the spirits before every vote', 'Let the Ouija board guide me', 'The ghosts have never been wrong'],
      'persona-41': ['Unleash my ultimate form', 'Power of friendship and screaming', 'Train in secret like a shonen arc'],
      'persona-32': ['Recruit everyone into my downline', 'Sell my way to the top', 'Turn elimination night into a pitch deck'],
      'persona-28': ['Help everyone find their best selves', 'Positive vibes only, aggressively', 'Heal the house whether they want it or not'],
      'persona-42': ['Destroy my ex, then maybe win', 'Revenge first, strategy second', 'I do not care about winning honestly'],
      'persona-45': ['Win their loyalty through fine cuisine', 'No one eliminates their personal chef', 'Cook better than everyone, at everything'],
      'persona-49': ['Write a song so good they keep me', 'Serenade my way out of elimination', 'Musical diplomacy, five minutes at a time'],
      'persona-31': ['Hiss at anyone who nominates me', 'Form a cat-lover alliance', 'My cats would want me to win'],
      'persona-39': ['Overshare until they feel too guilty', 'Make everyone my emotional hostage', 'No one eliminates someone mid-story'],
      'persona-36': ['Leverage my childhood fame', 'Remind everyone I was on television', 'Guilt them with my tragic backstory'],
      'persona-47': ['Psychoanalyze until they need me', 'Become everyone\'s unlicensed therapist', 'Make them emotionally dependent on me'],
    },
  },
  {
    id: 'q-movie-genre',
    text: 'If this game were a movie, what genre would it be?',
    narratorIntro: `'If this game were a movie, what genre would it be? The Game Master turned to {name}, {stereotype}. {description}'`,
    defaultAnswers: ['Psychological thriller', 'Dark comedy', 'A documentary no one asked for'],
    personaAnswers: {
      'persona-07': ['A tearjerker, obviously', 'Tragedy', 'A drama where I am the main character'],
      'persona-23': ['An action blockbuster starring me', 'A franchise with 4 sequels', 'Whatever gets the highest ratings'],
      'persona-06': ['A conspiracy documentary', 'Sci-fi horror', 'Whatever the producers do not want you to see'],
      'persona-44': ['A slow-burn forbidden romance', 'A trashy paperback come to life', 'Enemies-to-lovers with a twist'],
      'persona-43': ['A telenovela with 200 episodes', 'A soap opera with 4 slaps per scene', 'Pure melodrama, no subtlety'],
      'persona-35': ['A found-footage paranormal horror', 'A ghost documentary with real evidence', 'Whatever is haunting this building'],
    },
  },
  {
    id: 'q-under-bed',
    text: "What's hiding under your bed?",
    narratorIntro: `'What is hiding under the bed of {name}, {stereotype}? {description} The Game Master dared to ask.'`,
    defaultAnswers: ['Dust bunnies with attitude', 'Snacks I forgot about', 'My dignity from last year'],
    personaAnswers: {
      'persona-06': ['Government listening devices', 'My backup tin foil hat', 'A portal to the shadow dimension'],
      'persona-17': ["Last season's shoes", 'An emergency tiara', 'Unflattering photos from 2019'],
      'persona-11': ['A fully stocked bug-out bag', 'Classified field manuals', 'Nothing. I check it every night'],
      'persona-27': ['72-hour emergency ration kit', 'Night vision goggles and a machete', 'A detailed map to my bunker'],
      'persona-35': ['An EMF reader that is always beeping', 'Evidence of spectral activity', 'A Ouija board, just in case'],
      'persona-31': ['At least three of my fourteen cats', 'Cat toys and a lint roller', 'A framed photo of Mr. Whiskers'],
    },
  },
  {
    id: 'q-remembered-for',
    text: 'What will people remember about you after the game?',
    narratorIntro: `'When the game ends, what will people remember about {name}? {stereotype} — {description}'`,
    defaultAnswers: ['My chaos energy', 'That I was underestimated', 'Absolutely nothing'],
    personaAnswers: {
      'persona-18': ['The wisdom I bestowed', 'That I was right about everything', 'My devastating one-liners'],
      'persona-02': ['My abs', 'The showmance that defined the season', 'Being shirtless 90% of the time'],
      'persona-24': ['Wait, what show is this?', 'Being confused but happy', 'Accidentally winning something'],
      'persona-39': ['Way too many personal details', 'Stories no one wanted to hear', 'Making everyone deeply uncomfortable'],
      'persona-36': ['That cereal commercial I did at age 9', 'Constantly reminding people who I was', 'Demanding a private trailer'],
      'persona-37': ['Being confused the entire time', 'Accidentally being here', 'Asking where the bathroom is'],
      'persona-25': ['No one will know which version of me', 'The greatest performance ever given', 'Being three different people'],
      'persona-30': ['My terrible freestyle at elimination', 'Rhyming during a serious moment', 'The mixtape I left in the confessional'],
      'persona-32': ['Recruiting the camera crew into my MLM', 'Business cards in every pocket', 'The hustle that never stopped'],
      'persona-46': ['Hoarding all the toilet paper', 'The hidden snack fortress in my room', 'Saving money nobody asked me to save'],
      'persona-49': ['The guitar that never stopped playing', 'Songs nobody wanted to hear', 'That five-minute ballad about toast'],
      'persona-28': ['Aggressive positivity at all hours', 'Unsolicited affirmations', 'Healing people against their will'],
      'persona-50': ['Setting up dates during elimination', 'Ignoring the game to play matchmaker', 'The blind dates nobody asked for'],
      'persona-33': ['My allergy spreadsheet on the fridge', 'Thinking the lights gave me a rash', 'Sanitizing every surface twice'],
      'persona-44': ['Narrating every boring moment', 'Making breakfast sound like a romance', 'The trashy novel of our time here'],
    },
  },
  {
    id: 'q-guilty-pleasure',
    text: "What's your guilty pleasure?",
    narratorIntro: `'{description} But {name}, {stereotype}, has a guilty pleasure. The Game Master uncovered it.'`,
    defaultAnswers: ['Reality TV (ironic, right?)', 'Singing in the shower', 'Judging people silently'],
    personaAnswers: {
      'persona-22': ['Pop music, but never in public', 'Warm cookies with milk', 'Sometimes I smile and it terrifies me'],
      'persona-11': ['Romantic comedies', 'Bubble baths', 'Crying during Pixar movies'],
      'persona-05': ['Interpretive dance', 'Writing poetry about gains', 'Watching cooking shows'],
      'persona-27': ['Watching rom-coms in my bunker', 'Scented candles during supply checks', 'Knitting between perimeter sweeps'],
      'persona-48': ['Casual Fridays', 'Motivational posters unironically', 'A nap I call a power meeting'],
      'persona-34': ['Honey, but I feel terrible about it', 'I once ate a gummy bear by accident', 'Smelling bacon and not hating it'],
      'persona-41': ['Reading fan fiction of myself', 'Watching dubbed anime secretly', 'My real name, occasionally'],
    },
  },

  // --- Persona-specific questions ---
  {
    id: 'q-p22-art',
    text: 'What kind of art are you working on?',
    narratorIntro: `'The Game Master asked {name} about their art. {stereotype} — {description} What are they working on?'`,
    forPersonaId: 'persona-22',
    defaultAnswers: [],
    personaAnswers: {
      'persona-22': ['Portraits of people I despise', 'A sculpture made of rejection letters', 'Abstract rage on canvas'],
    },
  },
  {
    id: 'q-p05-real-sport',
    text: 'What counts as a real sport?',
    narratorIntro: `'{name}, {stereotype}. {description} The Game Master made the mistake of asking what counts as a real sport.'`,
    forPersonaId: 'persona-05',
    defaultAnswers: [],
    personaAnswers: {
      'persona-05': ['If you are not sweating, it is not a sport', 'Chess is for cowards', 'Everything is a sport if you try hard enough'],
    },
  },
  {
    id: 'q-p21-cover',
    text: 'How do you hide your wealth from the other players?',
    narratorIntro: `'{description} The Game Master asked {name}, {stereotype}, how they keep up the act.'`,
    forPersonaId: 'persona-21',
    defaultAnswers: [],
    personaAnswers: {
      'persona-21': ["Wear last season's clothes on purpose", 'Pretend I do not know what caviar is', 'My butler is on standby but hidden'],
    },
  },
  {
    id: 'q-p06-conspiracy',
    text: 'What conspiracy are the producers hiding?',
    narratorIntro: `'The Game Master should not have asked. But they did. {name}, {stereotype} — {description} What conspiracy are they hiding?'`,
    forPersonaId: 'persona-06',
    defaultAnswers: [],
    personaAnswers: {
      'persona-06': ['The votes are pre-determined by AI', 'There are hidden rooms with extra clues', 'The host is a hologram'],
    },
  },
  {
    id: 'q-p03-clipboard',
    text: "What's on your clipboard right now?",
    narratorIntro: `'{name}, {stereotype}. {description} The Game Master peeked at their clipboard.'`,
    forPersonaId: 'persona-03',
    defaultAnswers: [],
    personaAnswers: {
      'persona-03': ["A ranked list of alliance candidates", "My daughter's headshot and resume", 'Snack schedule for the house'],
    },
  },
  {
    id: 'q-p25-character',
    text: 'Who are you pretending to be right now?',
    narratorIntro: `'The Game Master caught {name} mid-performance. {stereotype} — {description} So who are they pretending to be?'`,
    forPersonaId: 'persona-25',
    defaultAnswers: [],
    personaAnswers: {
      'persona-25': ['A confident person who has it together', 'Whoever you need me to be', 'I cannot break character to answer that'],
    },
  },
  {
    id: 'q-p29-trick',
    text: 'Can you show us a magic trick right now?',
    narratorIntro: `'{name}, {stereotype}. {description} The Game Master made the mistake of asking for a demonstration.'`,
    forPersonaId: 'persona-29',
    defaultAnswers: [],
    personaAnswers: {
      'persona-29': ['Pick a card, any card. Not that one', 'Watch me make this alliance disappear', 'I need a volunteer and a live dove'],
    },
  },
  {
    id: 'q-p34-eat',
    text: 'What do you think about the house food?',
    narratorIntro: `'The Game Master brought up the house food. {name}, {stereotype} — {description} This was a mistake.'`,
    forPersonaId: 'persona-34',
    defaultAnswers: [],
    personaAnswers: {
      'persona-34': ['It is a crime against all living beings', 'I saw someone eat cheese and I screamed', 'I am foraging in the yard from now on'],
    },
  },
  {
    id: 'q-p35-haunted',
    text: 'Is this house haunted?',
    narratorIntro: `'{name}, {stereotype}, has been investigating. {description} The Game Master asked for their findings.'`,
    forPersonaId: 'persona-35',
    defaultAnswers: [],
    personaAnswers: {
      'persona-35': ['The voting booth is definitely haunted', 'I recorded EVP in the bathroom at 3am', 'Something follows me to every room'],
    },
  },
  {
    id: 'q-p38-chart',
    text: 'What does your birth chart say about winning?',
    narratorIntro: `'The Game Master humored {name}. {stereotype} — {description} What do the stars say about their chances?'`,
    forPersonaId: 'persona-38',
    defaultAnswers: [],
    personaAnswers: {
      'persona-38': ['My Jupiter is in the money house', 'Mercury retrograde is sabotaging me', 'The stars literally promised me this win'],
    },
  },
  {
    id: 'q-p40-spreadsheet',
    text: 'What does your spreadsheet say about the house?',
    narratorIntro: `'{name}, {stereotype}, pulled out a printed spreadsheet. {description} The Game Master peeked at the data.'`,
    forPersonaId: 'persona-40',
    defaultAnswers: [],
    personaAnswers: {
      'persona-40': ['Betrayal probability: 73.2% by Thursday', 'Three players are statistically doomed', 'My pivot table predicts the final four'],
    },
  },
  {
    id: 'q-p26-mansion',
    text: 'What do you think of the mansion?',
    narratorIntro: `'The Game Master showed {name} around the mansion. {stereotype} — {description} Their review was brutal.'`,
    forPersonaId: 'persona-26',
    defaultAnswers: [],
    personaAnswers: {
      'persona-26': ['Is this the servants\' quarters?', 'The tap water is basically poison', 'Where is the second swimming pool?'],
    },
  },
  {
    id: 'q-p37-here',
    text: 'Do you know what game you are playing?',
    narratorIntro: `'The Game Master checked in with {name}. {stereotype} — {description} A simple question with a troubling answer.'`,
    forPersonaId: 'persona-37',
    defaultAnswers: [],
    personaAnswers: {
      'persona-37': ['I thought this was a dentist office', 'Someone said there was free food', 'Is this not the line for the bathroom?'],
    },
  },
  {
    id: 'q-p43-dramatic',
    text: 'How would you handle being nominated for elimination?',
    narratorIntro: `'{name}, {stereotype}. {description} The Game Master asked how they would handle a nomination.'`,
    forPersonaId: 'persona-43',
    defaultAnswers: [],
    personaAnswers: {
      'persona-43': ['*slaps the nearest person dramatically*', 'Faint, revive, deliver a monologue', 'Demand the wind machine immediately'],
    },
  },
  {
    id: 'q-p48-meeting',
    text: 'How would you run a house meeting?',
    narratorIntro: `'The Game Master let {name} run a house meeting. {stereotype} — {description} It went about as well as expected.'`,
    forPersonaId: 'persona-48',
    defaultAnswers: [],
    personaAnswers: {
      'persona-48': ['Mandatory agenda, no sidebar chats', 'Fifteen slides and a Q&A session', 'Everyone gets an action item'],
    },
  },
];

// ── Selection Logic ──

/**
 * Select 3 questions for a persona. Picks all available persona-specific
 * questions first, then fills the rest from the generic pool. Shuffled.
 */
export function selectQuestionsForPersona(
  personaId: string,
  seed?: number
): QuestionWithOptions[] {
  // Deterministic shuffle using seed (game-specific randomization)
  const rng = seed !== undefined ? seededRandom(seed) : Math.random;

  // Separate persona-specific and generic questions
  const personaSpecific = QUESTION_POOL.filter(q => q.forPersonaId === personaId);
  const generic = QUESTION_POOL.filter(q => !q.forPersonaId);

  // Take up to 1 persona-specific, fill rest from generic (3 total)
  const maxPersonaSpecific = Math.min(personaSpecific.length, 1);
  const selected: QuestionDef[] = [
    ...shuffle(personaSpecific, rng).slice(0, maxPersonaSpecific),
    ...shuffle(generic, rng).slice(0, 3 - maxPersonaSpecific),
  ];

  // Build answer options for each
  return shuffle(selected, rng).map(q => ({
    id: q.id,
    text: q.text,
    options: buildAnswerOptions(q, personaId, rng),
  }));
}

/**
 * Build exactly 3 answer options for a question + persona.
 * Prefers persona-specific answers, fills from defaults.
 */
function buildAnswerOptions(
  question: QuestionDef,
  personaId: string,
  rng: () => number
): string[] {
  const personaAnswers = question.personaAnswers?.[personaId] ?? [];
  const genericAnswers = question.defaultAnswers;

  if (personaAnswers.length >= 3) {
    return shuffle([...personaAnswers], rng).slice(0, 3);
  }

  // Mix: persona answers first, fill from generic
  const remaining = genericAnswers.filter(a => !personaAnswers.includes(a));
  const needed = 3 - personaAnswers.length;
  return shuffle([
    ...personaAnswers,
    ...shuffle([...remaining], rng).slice(0, needed),
  ], rng);
}

/**
 * Resolve a player's submissions into QaEntry[] (resolved text).
 * Used by acceptInvite to store final answers.
 */
export function resolveAnswers(
  questions: QuestionWithOptions[],
  submissions: QaSubmission[],
  persona: { name: string; stereotype: string; description: string },
): QaEntry[] {
  return questions.map((q) => {
    const sub = submissions.find(s => s.questionId === q.id);
    let answer: string;

    if (!sub) {
      answer = q.options[0] ?? '';
    } else if (sub.selectedIndex === 3 && sub.customAnswer) {
      answer = sub.customAnswer.trim().slice(0, 140);
    } else {
      answer = q.options[sub.selectedIndex] ?? q.options[0] ?? '';
    }

    // Look up narrator intro template from QUESTION_POOL
    const def = QUESTION_POOL.find(d => d.id === q.id);
    const desc = persona.description.replace(/\.$/, ''); // strip trailing period
    const narratorIntro = (def?.narratorIntro ?? q.text)
      .replace(/\{name\}/g, persona.name)
      .replace(/\{stereotype\}/g, persona.stereotype)
      .replace(/\{description\}/g, desc);

    return { question: q.text, answer, narratorIntro };
  });
}

// ── Helpers ──

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}
