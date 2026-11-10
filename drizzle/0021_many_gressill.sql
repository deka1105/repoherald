ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");--> statement-breakpoint
-- Backfill: every account that predates the column gets a handle now, so that
-- nothing reads as "no username" after this ships. Self-contained on purpose —
-- a migration must not depend on today's src/lib/username.ts, which is free to
-- change, so the rules and the word lists are copied in as they stand today.
--
-- Order of preference matches ensureUsername(): the GitHub login where it
-- survives the rules (it is already what every byline calls that person), then
-- a random adjective-noun, then one with four digits, then the row id — which
-- cannot collide and is why the loop always terminates.
DO $$
DECLARE
  r RECORD;
  candidate text;
  tries int;
  adjectives text[] := ARRAY[
    'amber','brisk','bright','calm','clever','copper','crisp','deep','eager',
    'gentle','golden','happy','hidden','humble','keen','kind','lively','loyal',
    'lucky','mellow','merry','misty','noble','patient','placid','proud',
    'quiet','silent','silver','simple','sleek','snowy','steady','sunny',
    'swift','tidy','trusty','vivid','warm','wise'
  ];
  nouns text[] := ARRAY[
    'anchor','arbor','atlas','badger','beacon','bridge','cabin','canyon',
    'cedar','cipher','comet','compass','delta','ember','falcon','ferry',
    'forge','garden','glacier','granite','harbor','harvest','heron','hollow',
    'island','jetty','kernel','lantern','ledger','maple','meadow','orchard',
    'otter','pebble','pine','prairie','quarry','quill','ridge','river',
    'sandbar','sextant','signal','sparrow','summit','thicket','tide','timber',
    'valley','willow'
  ];
  reserved text[] := ARRAY[
    'about','account','admin','api','cookies','credits','feed','identify',
    'lists','manifest','post','privacy','promote','refunds','repos','robots',
    'search','sitemap','support','terms','unsubscribe','wallet','assets',
    'auth','blog','contact','dashboard','docs','help','home','legal','login',
    'logout','me','mcp','new','notifications','pricing','profile','public',
    'settings','signin','signout','signup','sponsor','static','status','u',
    'user','users','anonymous','deleted','everyone','help-desk','member',
    'moderator','mod','official','owner','repoherald','root','security',
    'staff','system','team','null','undefined'
  ];
BEGIN
  FOR r IN SELECT id, github_login FROM users WHERE username IS NULL LOOP
    candidate := lower(trim(coalesce(r.github_login, '')));

    -- The same rules checkUsername() applies: length, charset, a letter or
    -- digit at each end, no doubled separator, not reserved, not wearing a
    -- prefix this system writes itself.
    IF candidate !~ '^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$'
       OR length(candidate) < 3
       OR length(candidate) > 39
       OR candidate ~ '[._-]{2,}'
       OR candidate = ANY (reserved)
       OR candidate LIKE 'deleted-%'
       OR candidate LIKE 'member-%'
       OR EXISTS (SELECT 1 FROM users WHERE username = candidate)
    THEN
      candidate := NULL;
    END IF;

    tries := 0;
    WHILE candidate IS NULL AND tries < 20 LOOP
      candidate :=
        adjectives[1 + floor(random() * array_length(adjectives, 1))::int] || '-' ||
        nouns[1 + floor(random() * array_length(nouns, 1))::int] ||
        CASE WHEN tries = 0 THEN ''
             ELSE '-' || lpad(floor(random() * 10000)::int::text, 4, '0') END;
      IF EXISTS (SELECT 1 FROM users WHERE username = candidate) THEN
        candidate := NULL;
      END IF;
      tries := tries + 1;
    END LOOP;

    IF candidate IS NULL THEN
      candidate := 'member-' || left(replace(r.id::text, '-', ''), 12);
    END IF;

    UPDATE users SET username = candidate WHERE id = r.id;
  END LOOP;
END $$;
