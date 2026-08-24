# Tea Explorer

A SvelteKit frontend for searching teas with real-time fuzzy autocomplete. Built with SvelteKit 2, Tailwind CSS v4, shadcn-svelte, Paraglide i18n (EN/DE), and Supabase.

## Features

- **Real-time fuzzy search** — Type to search across tea name, style, type, and origin with 300ms debounce
- **PostgreSQL pg_trgm** — Server-side fuzzy matching using `word_similarity` for accurate results
- **Internationalization** — English and German via Paraglide with pathname routing (`/` and `/de/`)
- **Accessible autocomplete** — Keyboard navigation (↑/↓/Enter/Esc), screen reader support, click-outside-to-close
- **Modern stack** — Svelte 5 runes, Tailwind v4, shadcn-svelte components

## Tech Stack

| Layer         | Technology                |
| ------------- | ------------------------- |
| Framework     | SvelteKit 2 (Svelte 5)    |
| Styling       | Tailwind CSS v4           |
| UI Components | shadcn-svelte (huntabyte) |
| i18n          | Paraglide (inlang)        |
| Database      | Supabase (PostgreSQL)     |
| Search        | pg_trgm `word_similarity` |

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
```

### 2. The `search_teas` function

Applied via Supabase migration `tokenized_multiword_search_teas`. Signature:

```sql
search_teas(
  p_search_term text,               -- query string
  p_limit integer DEFAULT 8,        -- page size
  p_offset integer DEFAULT 0,       -- pagination offset
  p_sort text DEFAULT 'relevance'   -- 'relevance' | 'price_asc' | 'price_desc'
)
```

Matching behavior:

- The query is split into lowercase tokens; stopwords (`tea`, `tee`, `the`, `a`, `an`, `and`, `of`) are dropped.
- Every remaining token must match **at least one field** with `word_similarity > 0.7` — AND across tokens, OR across fields.
- Fields compared: `tea.name`, `tea.style_raw`, `type.key`, `tea.origin`, `vendor.name`, `vendor.tags`, `style.tags`, `type.tags`.
- Relevance ranking: average of per-token best-field similarity; `price_asc`/`price_desc` sort by normalized price per 100g (NULLS LAST).
- Returns the latest price snapshot per tea (cheapest variant first) plus `p_total_count` for pagination.

Returned columns: `p_id`, `p_name`, `p_style_label`, `p_type_key`, `p_origin`, `p_origin_country`, `p_url`, `p_price`, `p_currency`, `p_weight_grams`, `p_price_100g_usd`, `p_vendor_name`, `p_harvest_year`, `p_total_count`.

### 3. (Optional) Add GIN indexes for better performance

```sql
CREATE INDEX IF NOT EXISTS idx_tea_name_trgm ON tea USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tea_style_raw_trgm ON tea USING GIN (style_raw gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tea_origin_trgm ON tea USING GIN (origin gin_trgm_ops);
```

The `tea` table should have columns: `id`, `name`, `style_raw`, `type` (FK to `type` table), `origin`, `origin_country`, `vendor` (FK to `vendor` table). The `type` table needs `id`, `key`, and `tags` columns; `style` needs `id` and `tags`.

## Available Scripts

| Command           | Description                      |
| ----------------- | -------------------------------- |
| `npm run dev`     | Start dev server with hot reload |
| `npm run build`   | Build for production             |
| `npm run preview` | Preview production build locally |
| `npm run check`   | Run svelte-check (TypeScript)    |
| `npm run lint`    | Run ESLint                       |
| `npm run format`  | Format with Prettier             |

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
│   │   │   └── search.svelte.ts            # Currency state (Svelte 5 runes)
│   │   ├── types/
│   │   │   └── tea.ts                      # TypeScript interfaces
│   ├── routes/
│   │   ├── +layout.svelte                  # Root layout with header + language switcher
│   │   ├── +page.svelte                    # Home page with search
│   │   └── api/search/
│   │       └── +server.ts                  # Search API endpoint
│   ├── app.html
│   ├── hooks.server.ts                     # Paraglide server init
│   └── hooks.ts                            # Paraglide client init
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

| Key                  | English          | German                 |
| -------------------- | ---------------- | ---------------------- |
| `search.placeholder` | "Search teas..." | "Tees suchen..."       |
| `search.noResults`   | "No teas found." | "Keine Tees gefunden." |
| `search.loading`     | "Searching..."   | "Suche läuft..."       |
| `language.english`   | "English"        | "Englisch"             |
| `language.german`    | "German"         | "Deutsch"              |

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

**Endpoint**: `GET /api/search?q=<term>&offset=<n>&currency=<EUR|USD>&sort=<relevance|price_asc|price_desc>`

**Response**:

```json
{
	"results": [
		{
			"id": 123,
			"name": "Sencha Yamabuki",
			"style_label": "Sencha",
			"type_key": "green",
			"origin": "Fuji, Shizuoka",
			"origin_country": "JP",
			"url": "https://...",
			"vendor_name": "Yoshi en",
			"harvest_year": 2025,
			"price": 12.5,
			"currency": "EUR",
			"weight_grams": 50,
			"price_100g_usd": 27.5,
			"price_display": 27.5,
			"currency_display": "EUR"
		}
	],
	"totalCount": 21
}
```

**Parameters**:

- `q` (required): Search query string
- `offset` (optional, default `0`): Pagination offset
- `currency` (optional, default `EUR`): Display currency (`EUR` | `USD`)
- `sort` (optional, default `relevance`): `relevance` | `price_asc` | `price_desc`

**Behavior**:

- Empty query → `{ results: [], totalCount: 0 }`
- Debounced 300ms on client
- Paginated, 10 results per page
- Multi-word queries: every token must match (AND), stopwords (`tea`, `tee`, `the`, ...) dropped
- Fuzzy match threshold: per-token `word_similarity > 0.7` against name, style, type, origin, vendor, and tags

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
