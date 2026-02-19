DROP TABLE IF EXISTS PersonaPool;

CREATE TABLE PersonaPool (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stereotype TEXT NOT NULL,
  description TEXT NOT NULL,
  theme TEXT NOT NULL DEFAULT 'DEFAULT',
  created_at INTEGER NOT NULL
);

INSERT INTO PersonaPool (id, name, stereotype, description, theme, created_at) VALUES
  ('persona-01', 'Bella Rossi', 'The Influencer', 'Lives for the likes, dies for lack of Wi-Fi. Filters everything, including her personality.', 'DEFAULT', 1708300800000),
  ('persona-02', 'Chad Brock', 'The Showmance', 'Here to find love and maybe a protein shake. His shirt is allergic to his body.', 'DEFAULT', 1708300800000),
  ('persona-03', 'Sheila Bear', 'The Momager', 'She didn''t come to make friends; she came to make her daughter a star. Beware the clipboard.', 'DEFAULT', 1708300800000),
  ('persona-04', 'Silas Vane', 'The Backstabber', 'Whispers lies into ears and smiles for the cameras. He has a knife for every back.', 'DEFAULT', 1708300800000),
  ('persona-05', 'Brick Thompson', 'The Jock', 'Winning is the only thing that matters. Losing makes him cry, but in a manly way.', 'DEFAULT', 1708300800000),
  ('persona-06', 'Kevin King', 'The Conspiracy Theorist', 'Believes the producers are lizards and the voting is rigged by ghosts. Wears a lot of tin foil.', 'DEFAULT', 1708300800000),
  ('persona-07', 'Penelope Pout', 'The Crying Mess', 'Everything is a tragedy. She can produce tears on command, and she usually does.', 'DEFAULT', 1708300800000),
  ('persona-08', 'Big Z', 'The Zen Master', 'Meditates through the screaming matches. He is one with the universe and the prize money.', 'DEFAULT', 1708300800000),
  ('persona-09', 'Brenda Burns', 'The Villain', 'Needs to know everyone''s secret. Knowledge is power, and she is a nuclear plant.', 'DEFAULT', 1708300800000),
  ('persona-10', 'Arthur Penske', 'The Superfan', 'Has watched every episode twice. Knows your stats better than you do. Scary levels of prepared.', 'DEFAULT', 1708300800000),
  ('persona-11', 'Gary Grumble', 'The Retired General', 'Thinks this is a combat mission. Expects push-ups at 4 AM and total discipline.', 'DEFAULT', 1708300800000),
  ('persona-12', 'Luna Star', 'The Quirky Artist', 'Painted a mural on the bedroom wall with fruit juice. Just wants to express her soul.', 'DEFAULT', 1708300800000),
  ('persona-13', 'Jax Cash', 'The Tech Bro', 'Disrupting the game with algorithms. Thinks he is the smartest person in any room.', 'DEFAULT', 1708300800000),
  ('persona-14', 'Daisy Miller', 'The Small Town Girl', 'Never left her county before this. Everything is amazing, even the betrayal.', 'DEFAULT', 1708300800000),
  ('persona-15', 'Spike Spade', 'The Professional Poker Player', 'Can''t read his face, but can read your soul. Always has a hidden card.', 'DEFAULT', 1708300800000),
  ('persona-16', 'Max Gainz', 'The Gym Rat', 'If it''s not a leg day, it''s a bad day. His veins have veins.', 'DEFAULT', 1708300800000),
  ('persona-17', 'Tiffany Jewel', 'The Pageant Queen', 'World peace is great, but a crown is better. Perfect hair, even in a hurricane.', 'DEFAULT', 1708300800000),
  ('persona-18', 'Evelyn Wise', 'The Older Wisdom Figure', 'Gives advice like a fortune cookie. Probably the most dangerous person here.', 'DEFAULT', 1708300800000),
  ('persona-19', 'Skyler Blue', 'The Party Animal', 'Started the party before the plane landed. Will probably get kicked off by episode three.', 'DEFAULT', 1708300800000),
  ('persona-20', 'Chet Baker', 'The Over-Competitive Dad', 'Treating the alliance like a PTA meeting. Nobody grills better than him.', 'DEFAULT', 1708300800000),
  ('persona-21', 'Baron Rich', 'The Undercover Billionaire', 'Pretending to be a janitor. Actually owns the network. Terrible at acting poor.', 'DEFAULT', 1708300800000),
  ('persona-22', 'Raven Thorne', 'The Goth Rebel', 'Hates everyone and everything. Only here to pay off her art school loans.', 'DEFAULT', 1708300800000),
  ('persona-23', 'Dirk Danger', 'The Reality TV Legend', 'Was on three other shows. Knows exactly where the cameras are at all times.', 'DEFAULT', 1708300800000),
  ('persona-24', 'Wally Wander', 'The Clueless Tourist', 'Has no idea what show he is on. Just happy to be included.', 'DEFAULT', 1708300800000);
