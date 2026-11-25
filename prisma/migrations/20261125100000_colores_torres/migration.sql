-- Variables de color de torre con nombre neutro (las torres se identifican por letra).
UPDATE "torre" SET "color" = CASE "color"
  WHEN 'var(--torre-avenue)' THEN 'var(--torre-a)'
  WHEN 'var(--torre-sky)' THEN 'var(--torre-b)'
  WHEN 'var(--torre-pilay)' THEN 'var(--torre-c)'
  WHEN 'var(--torre-ne)' THEN 'var(--torre-d)'
  ELSE "color" END;
