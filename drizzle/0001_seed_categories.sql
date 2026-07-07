INSERT INTO "categories" ("kind", "slug", "label") VALUES
  ('use_case', 'cli-tools', 'CLI Tools'),
  ('use_case', 'dev-tooling', 'Dev Tooling'),
  ('use_case', 'data-ml', 'Data & ML'),
  ('use_case', 'web-frameworks', 'Web Frameworks'),
  ('use_case', 'security', 'Security'),
  ('use_case', 'automation', 'Automation'),
  ('sector', 'healthcare', 'Healthcare'),
  ('sector', 'fintech', 'Fintech'),
  ('sector', 'education', 'Education'),
  ('sector', 'climate', 'Climate'),
  ('sector', 'e-commerce', 'E-commerce'),
  ('sector', 'gov-civic', 'Gov & Civic')
ON CONFLICT DO NOTHING;
