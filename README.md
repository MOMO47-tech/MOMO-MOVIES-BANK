# MOMO MOVIES BANK

MOMO MOVIES BANK ni tovuti ya movie discovery yenye muonekano wa neon-green, nyota zinazosogea, passcode ya pamoja, kaunta ya uanachama na catalog ya filamu. Inatumia metadata, posters, trela na viungo vya huduma rasmi; haihosti filamu wala kutoa viungo vya download.

## Stack na kuendesha preview

Tovuti ni HTML/CSS/JavaScript isiyotegemea frontend framework. Vercel hu-host files za static na functions zilizo ndani ya `api/`. Local preview inatumia Node.js built-ins pekee; Node 20+ inapendekezwa.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Kwenye local preview, kitufe cha “Angalia mwonekano wa demo” hufungua catalog ya mifano. Fomu ya kuingia haikubali credentials kwenye local preview; authentication halisi hufanya kazi tu baada ya Vercel secrets na Supabase kusanidiwa.

## Supabase setup

1. Fungua Supabase SQL editor kwenye project unayotaka kutumia na utekeleze `supabase/schema.sql`.
2. Schema huunda `public.momo_movie_members` yenye HMAC ya namba tu na `joined_at`; namba halisi haijahifadhiwa. RLS imewashwa, hakuna public select policy, na API ya tovuti hurudisha jumla pekee.
3. Unda service-role key kwa matumizi ya upande wa server tu. Usiweke key hii kwenye `app.js`, `index.html`, GitHub, au env vars zenye prefix ya public.

## Vercel environment variables

Weka variables hizi katika Vercel Project Settings → Environment Variables kwa Preview na Production zinazotakiwa:

- `SITE_GATE_PASSWORD`: tengeneza shared password mpya; usitumie ile iliyokwishaandikwa kwenye mazungumzo. Password inasomwa na API ya server tu.
- `SESSION_SECRET`: siri random ya angalau herufi 32.
- `PHONE_HASH_SECRET`: siri tofauti ya random yenye angalau herufi 24; hutumika kutengeneza HMAC ya namba.
- `SUPABASE_URL`: URL ya project.
- `SUPABASE_SERVICE_ROLE_KEY`: key ya upande wa server tu.
- `TMDB_API_KEY`: API key ya TMDB; bila hii site huonyesha catalog ndogo ya mfano.
- `TMDB_WATCH_REGION`: hiari; default ni `TZ`.

Tengeneza secrets mbili tofauti, kwa mfano `openssl rand -hex 32`. `.env.example` ina majina ya variables tu na si credentials halisi. Usicommit `.env`.

**Kumbuka:** shared passcode ni gate ya msingi, si uthibitishaji wa utambulisho. Namba haitathibitishwa kwa SMS; namba halisi haihifadhiwi, hivyo huwezi kuitumia kuwasiliana na waliojiunga. Tumia password mpya kwa sababu ile iliyotajwa awali kwenye mazungumzo tayari imefichuka.

## Vercel deployment

1. Vercel dashboard → Add New → Project → import `MOMO47-tech/MOMO-MOVIES-BANK`.
2. Branch ya production ya project hii ni `feature/momo-movies-bank`. Project ni static + serverless; hakuna build command au dependency ya frontend inayohitajika. Vercel itatengeneza domain ya `*.vercel.app` (jina la project linaweza kuchaguliwa ikiwa halijachukuliwa).
3. Weka environment variables zilizo juu, redeploy, kisha hakiki `/api/session`, `/api/member-count` na login.

Push mpya kwenye branch ya production itasababisha Vercel kujenga deployment mpya ikiwa repository imeunganishwa.

## Movie data / credits

Movie metadata, posters na trailers za sasa hupitia API ya TMDB upande wa server. Site inajumuisha approved TMDB logo na notice hii: “This product uses the TMDB API but is not endorsed or certified by TMDB.” TMDB developer API ni kwa matumizi yasiyo ya kibiashara; wasiliana na TMDB kuhusu leseni ya matumizi ya kibiashara. Hakuna movie files au unauthorized streaming/download links zinazotolewa.
