-- Add 26 new personas (persona-25 through persona-50)
-- Source: reality_royale_characters sets 2 & 3 (deduplicated)

INSERT INTO PersonaPool (id, name, stereotype, description, theme, created_at) VALUES
  -- Set 2: 24 personas
  ('persona-25', 'Felix Stage', 'The Method Actor', 'Pretends to be other contestants to mind-game them. Stays in character even while sleeping.', 'DEFAULT', 1743465600000),
  ('persona-26', 'Preston Sterling', 'The Trust Fund Baby', 'Thinks a banana costs fifty dollars. Complains endlessly about the mansion''s tap water.', 'DEFAULT', 1743465600000),
  ('persona-27', 'Hank Bunker', 'The Doomsday Prepper', 'Brought a tactical machete to a dating show. Constantly checking the exits for zombies.', 'DEFAULT', 1743465600000),
  ('persona-28', 'Joy Sparkle', 'The Overzealous Life Coach', 'Aggressively positive. Will attempt to heal your deep-rooted trauma whether you want it or not.', 'DEFAULT', 1743465600000),
  ('persona-29', 'Presto Pete', 'The Amateur Magician', 'Tries to resolve intense house conflicts with cheap card tricks. Keeps live doves in his jacket.', 'DEFAULT', 1743465600000),
  ('persona-30', 'Lil'' Syllable', 'The Wannabe Rapper', 'Rhymes terribly during serious confessionals. Constantly trying to drop his mixtape in the elimination box.', 'DEFAULT', 1743465600000),
  ('persona-31', 'Martha Meow', 'The Cat Lady', 'Compares everyone to her fourteen cats. Literally hisses at people when nominated for elimination.', 'DEFAULT', 1743465600000),
  ('persona-32', 'Kenzie Boss', 'The MLM Boss Babe', 'Always hustling. Tries to recruit the camera crew into her essential oils pyramid scheme.', 'DEFAULT', 1743465600000),
  ('persona-33', 'Sickly Simon', 'The Hypochondriac', 'Convinced the studio lighting is giving him a rare tropical rash. Allergic to the drama.', 'DEFAULT', 1743465600000),
  ('persona-34', 'Kale Leafson', 'The Extreme Vegan', 'Screams at people for eating cheese. Attempts to photosynthesize in the backyard during challenges.', 'DEFAULT', 1743465600000),
  ('persona-35', 'Spooky Specter', 'The Ghost Hunter', 'Claims the voting booth is haunted. Refuses to eliminate anyone without consulting a Ouija board.', 'DEFAULT', 1743465600000),
  ('persona-36', 'Timmy Tinsel', 'The Former Child Star', 'Peaked at age nine in a famous cereal commercial. Demands his own private trailer.', 'DEFAULT', 1743465600000),
  ('persona-37', 'Barry Bumbling', 'The Accidental Contestant', 'Thought he was in line for the bathroom. Now he''s competing for a million dollars.', 'DEFAULT', 1743465600000),
  ('persona-38', 'Venus Retrograde', 'The Astrology Obsessive', 'Blames all bad alliances on Mercury being in retrograde. Insists on reading everyone''s auras daily.', 'DEFAULT', 1743465600000),
  ('persona-39', 'TMI Tammy', 'The Over-Sharer', 'Tells you all about her terrible digestive issues within five seconds of meeting you.', 'DEFAULT', 1743465600000),
  ('persona-40', 'Ned Numbers', 'The Methodical Accountant', 'Calculates alliance betrayals using a printed spreadsheet and a vintage pocket calculator. Zero social skills.', 'DEFAULT', 1743465600000),
  ('persona-41', 'Anime Annie', 'The Hardcore Cosplayer', 'Screams her attacks during physical challenges. Refuses to break character or use her real name.', 'DEFAULT', 1743465600000),
  ('persona-42', 'Scorned Sarah', 'The Vengeful Ex', 'Only came on the show to ruin her ex-boyfriend''s life. Has no interest in winning.', 'DEFAULT', 1743465600000),
  ('persona-43', 'Gloria Drama', 'The Soap Opera Diva', 'Slaps people dramatically and faints on cue. Demands a wind machine for her exit interviews.', 'DEFAULT', 1743465600000),
  ('persona-44', 'Quill Passion', 'The Romance Novelist', 'Narrates the house''s mundane events out loud as if writing a trashy paperback romance.', 'DEFAULT', 1743465600000),
  ('persona-45', 'Chef Pierre', 'The Culinary Snob', 'Refuses to eat house slop. Frequently tries to forage for rare truffles in the backyard.', 'DEFAULT', 1743465600000),
  ('persona-46', 'Penny Pincher', 'The Extreme Cheapskate', 'Hoards the mansion''s toilet paper in her suitcase and hides all the complimentary snacks.', 'DEFAULT', 1743465600000),
  ('persona-47', 'Dr. Freudian', 'The Unlicensed Therapist', 'Analyzes everyone''s childhood trauma over breakfast. Completely unqualified, but carries a clipboard everywhere.', 'DEFAULT', 1743465600000),
  ('persona-48', 'Corporate Carl', 'The Middle Management Drone', 'Treats the reality game like a corporate merger. Constantly tries to schedule mandatory synergy meetings.', 'DEFAULT', 1743465600000),
  -- Set 3: 2 unique personas
  ('persona-49', 'Strummer Steve', 'The Guy Who Brought a Guitar', 'Answers every simple question with a spontaneously composed five-minute acoustic indie-folk song. Nobody is amused.', 'DEFAULT', 1743465600000),
  ('persona-50', 'Cupid Cathy', 'The Overzealous Matchmaker', 'Ignores the actual prize money to aggressively set up uncomfortable blind dates between her teammates.', 'DEFAULT', 1743465600000);
