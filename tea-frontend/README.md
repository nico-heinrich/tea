# Tea Explorer

A SvelteKit frontend for searching teas with real-time fuzzy autocomplete. Built with SvelteKit 2, Tailwind CSS v4, shadcn-svelte, Paraglide i18n (EN/DE), and Supabase.

## Features

- **Real-time fuzzy search** — Type to search across tea name, style, type, and origin with 300ms debounce
- **PostgreSQL pg_trgm** — Server-side fuzzy matching using `word_similarity` for accurate results
- **Internationalization** — English and German via Paraglide with pathname routing (`/` and `/de/`)
- **Accessible autocomplete** — Keyboard navigation (↑/↓/Enter/Esc), screen reader support, click-outside-to-close
- **Modern stack** — Svelte 5 runes, Tailwind v4, shadcn-svelte components

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | SvelteKit 2 (Svelte 5) |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn-svelte (huntabyte) |
| i18n | Paraglide (inlang) |
| Database | Supabase (PostgreSQL) |
| Search | pg_trgm `word_similarity` |

## Prerequisites

- Node.js 20+
- npm/pnpm/yarn
- Supabase project with `tea` table and `search_teas` function (see Database Setup)

## Quick Start

```bash
# 1. Clone and enter the project
cd tea-frontend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# 4. Start development server
npm run dev
```

Visit `http://localhost:5173` (English) or `http://localhost:5173/de` (German).

## Environment Variables

Create `.env` from `.env.example`:

```env
# Supabase project URL (public, safe to expose to client)
PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# Supabase anon/public key (public, protected by RLS)
PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Both variables use the `PUBLIC_` prefix so SvelteKit substitutes them at build time via `$env/static/public`.

## Database Setup

Run these migrations in your Supabase SQL Editor:

```sql
-- 1. Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create the search function
CREATE OR REPLACE FUNCTION search_teas(search_term text)
RETURNS TABLE(
  id bigint,
  name text,
  style_raw text,
  type_key text,
  origin text,
  origin_country text
)
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tea.id,
    tea.name,
    tea.style_raw,
    type.key,
    tea.origin,
    tea.origin_country
  FROM tea
  JOIN type ON tea.type = type.id
  WHERE
    word_similarity(search_term, tea.name) > 0.3
    OR (tea.style_raw IS NOT NULL AND word_similarity(search_term, tea.style_raw) > 0.3)
    OR word_similarity(search_term, type.key) > 0.3
    OR (tea.origin IS NOT NULL AND word_similarity(search_term, tea.origin) > 0.3)
  ORDER BY
    GREATEST(
      word_similarity(search_term, tea.name),
      COALESCE(word_similarity(search_term, tea.style_raw), 0),
      word_similarity(search_term, type.key),
      COALESCE(word_similarity(search_term, tea.origin), 0)
    ) DESC
  LIMIT 8;
END;
$$;

-- 3. (Optional) Add GIN indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tea_name_trgm ON tea USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tea_style_raw_trgm ON tea USING GIN (style_raw gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tea_origin_trgm ON tea USING GIN (origin gin_trgm_ops);
```

The `tea` table should have columns: `id`, `name`, `style_raw`, `type` (FK to `type` table), `origin`, `origin_country`. The `type` table needs `id` and `key` columns.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run check` | Run svelte-check (TypeScript) |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |

## Project Structure

```
tea-frontend/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── search/
│   │   │   │   ├── SearchInput.svelte      # Autocomplete input with dropdown
│   │   │   │   └── SuggestionItem.svelte   # Individual suggestion with highlighting
│   │   │   └── ui/                         # shadcn-svelte components
│   │   ├── paraglide/                      # Generated i18n messages
│   │   ├── server/
│   │   │   └── supabase.ts                 # Server-side Supabase client
│   │   ├── stores/
│   │   │   └── search.svelte.ts            # Search state (Svelte 5 runes)
│   │   ├── types/
│   │   │   └── tea.ts                      # TypeScript interfaces
│   │   └── supabase.ts                     # Browser Supabase client
│   ├── routes/
│   │   ├── +layout.svelte                  # Root layout with header + language switcher
│   │   ├── +page.svelte                    # Home page with search
│   │   └── api/search/
│   │       └── +server.ts                  # Search API endpoint
│   ├── app.html
│   └── hooks.client.ts                     # Paraglide client init
├── messages/
│   ├── en.json                             # English translations
│   └── de.json                             # German translations
├── .env.example
├── package.json
├── svelte.config.js
├── tsconfig.json
├── vite.config.ts
└── paraglide.config.js
```

## Internationalization

Paraglide is configured with **pathname strategy** (URL-based locale):

- `/` — English (base locale)
- `/de/` — German

### Adding Translations

1. Edit `messages/en.json` and `messages/de.json`
2. Run `npm run dev` — Paraglide regenerates types automatically
3. Use in components: `import * as m from '$lib/paraglide/messages.js';` then `m["search.placeholder"]()`

### Message Keys

| Key | English | German |
|-----|---------|--------|
| `search.placeholder` | "Search teas..." | "Tees suchen..." |
| `search.noResults` | "No teas found." | "Keine Tees gefunden." |
| `search.loading` | "Searching..." | "Suche läuft..." |
| `language.english` | "English" | "Englisch" |
| `language.german` | "German" | "Deutsch" |

## Deployment

### Netlify (Recommended)

1. Connect your repository to Netlify
2. Build command: `npm run build`
3. Output directory: `build` (or configure adapter-netlify)
4. Add environment variables in Netlify dashboard

### Vercel

1. Install `@sveltejs/adapter-vercel`
2. Configure `svelte.config.js` to use the Vercel adapter
3. Deploy with Vercel CLI or GitHub integration

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "build"]
```

## Search API

**Endpoint**: `GET /api/search?q=<term>`

**Response**:
```json
{
  "suggestions": [
    {
      "id": 123,
      "name": "Sencha Yamabuki",
      "style_raw": "Sencha",
      "type_key": "green",
      "origin": "Fuji, Shizuoka",
      "origin_country": "JP"
    }
  ]
}
```

**Parameters**:
- `q` (required): Search query string

**Behavior**:
- Empty query → `{ suggestions: [] }`
- Debounced 300ms on client
- Max 8 results
- Fuzzy match threshold: `word_similarity > 0.3`

## Development Notes

### Svelte 5 Runes

The search store uses Svelte 5 runes (`$state`, `$derived`, `$effect`) instead of legacy stores:

```ts
// src/lib/stores/search.svelte.ts
let query = $state('');
let suggestions = $state<TeaSuggestion[]>([]);
let loading = $state(false);
let error = $state<string | null>(null);

$effect(() => {
  // Debounced fetch logic
});
```

### Adding shadcn-svelte Components

```bash
npx shadcn-svelte@latest add dialog dropdown-menu --yes --cwd tea-frontend
```

### Paraglide Workflow

```bash
# Add new message keys to messages/en.json and messages/de.json
# Types regenerate automatically on dev server restart
# Use in components: import * as m from '$lib/paraglide/messages.js';
```

## License

MIT