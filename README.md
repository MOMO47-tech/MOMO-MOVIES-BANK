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

1. Fungua Supabase SQL editor kwenye project unayotumia na utekeleze `supabase/schema.sql`. Inaunda jedwali la uanachama, orodha ya admin, na library ya video yenye RLS.
2. `momo_movie_members`, `momo_movie_admins`, na `momo_movie_library` hazisomeki moja kwa moja na `anon` au `authenticated`; API ya server pekee hutumia service-role key. Kaunta ya tovuti hurudisha jumla ya wanachama tu.
3. Katika Supabase → Authentication → Users, tengeneza akaunti ya admin yenye email na nenosiri. Kisha tekeleza SQL hii ukibadilisha email:

   ```sql
   insert into public.momo_movie_admins (user_id)
   select id from auth.users where lower(email) = lower('admin@example.com')
   on conflict (user_id) do nothing;
   ```

4. Unda service-role key kwa matumizi ya upande wa server tu. Usiweke key hii kwenye `app.js`, `admin.js`, `index.html`, GitHub, au env vars zenye prefix ya public.

## Vercel environment variables

Weka variables hizi katika Vercel Project Settings → Environment Variables kwa Preview na Production zinazotakiwa:

- `SITE_GATE_PASSWORD`: tengeneza shared password mpya; usitumie ile iliyokwishaandikwa kwenye mazungumzo. Password inasomwa na API ya server tu.
- `SESSION_SECRET`: siri random ya angalau herufi 32.
- `PHONE_HASH_SECRET`: siri tofauti ya random yenye angalau herufi 24; hutumika kutengeneza HMAC ya namba.
- `SUPABASE_URL`: URL ya project.
- `SUPABASE_ANON_KEY`: hiari; ikiwekwa, API ya admin huitumia. Isipokuwepo, login hutumia `SUPABASE_SERVICE_ROLE_KEY` iliyopo kwa Supabase Auth upande wa server pekee.
- `SUPABASE_SERVICE_ROLE_KEY`: key ya upande wa server tu.
- `TMDB_API_KEY`: API key ya TMDB; bila hii site huonyesha catalog ndogo ya mfano.
- `TMDB_WATCH_REGION`: hiari; default ni `TZ`.

Tengeneza secrets mbili tofauti, kwa mfano `openssl rand -hex 32`. `.env.example` ina majina ya variables tu na si credentials halisi. Usicommit `.env`.

**Kumbuka:** shared passcode ni gate ya msingi, si uthibitishaji wa utambulisho. Namba haitathibitishwa kwa SMS; namba halisi haihifadhiwa, hivyo huwezi kuitumia kuwasiliana na waliojiunga. Tumia password mpya kwa sababu ile iliyotajwa awali kwenye mazungumzo tayari imefichuka.

## Dashibodi ya admin na player ya ndani

Fungua `/admin` na uingie kwa akaunti ya Supabase Auth ambayo UUID yake imeongezwa kwenye `momo_movie_admins`. Ili kuanzisha akaunti, tengeneza user kwenye Supabase → Authentication → Users, kisha tekeleza SQL hii ukibadilisha email:

```sql
insert into public.momo_movie_admins (user_id)
select id from auth.users where lower(email) = lower('admin@example.com')
on conflict (user_id) do nothing;
```

Passcode ya pamoja ya lounge haitoi ruhusa ya admin. Session ya admin ni cookie ya HttpOnly ya saa 8; ruhusa hukaguliwa tena dhidi ya allow-list, na mabadiliko ya dashboard hukubali maombi ya same-origin pekee.

Admin anaweza kuongeza, kuhariri, kuchapisha, kuficha au kufuta filamu/series. Ili kuchapisha maudhui, dashboard inahitaji player, URL ya chanzo/uthibitisho wa haki, maelezo ya ruhusa na uthibitisho wa admin. Player inaruhusu HTTPS MP4/WebM/HLS au embed za Vimeo/YouTube no-cookie zilizowekwa ndani ya MOMO; hakuna utafutaji wa YouTube unaofunguliwa nje. Weka filamu kamili tu ikiwa una leseni/ruhusa ya kusambaza na kuchezesha. TMDB bado hutoa metadata na trela rasmi; filamu zisizoidhinishwa huonyesha huduma rasmi za kutazama badala ya player ya full movie.

Baada ya admin kuingia, rekodi zilizowekwa `rights_verified` na `is_published` ndizo pekee zinazorudishwa kwa wageni na kuchezwa ndani ya tovuti. Hakuna video inayopakiwa kwenye Supabase na dashboard haiongezi direct-download link.

## Vercel deployment

1. Vercel dashboard → Add New → Project → import `MOMO47-tech/MOMO-MOVIES-BANK`.
2. Branch ya production ya project hii ni `feature/momo-movies-bank`. Project ni static + serverless; hakuna build command au dependency ya frontend inayohitajika. Vercel itatengeneza domain ya `*.vercel.app` (jina la project linaweza kuchaguliwa ikiwa halijachukuliwa).
3. Weka environment variables zilizo juu, redeploy, kisha hakiki `/api/session`, `/api/member-count` na login.

Push mpya kwenye branch ya production itasababisha Vercel kujenga deployment mpya ikiwa repository imeunganishwa.

## Movie data / credits

Movie metadata, posters na trailers za sasa hupitia API ya TMDB upande wa server. Site inajumuisha approved TMDB logo na notice hii: “This product uses the TMDB API but is not endorsed or certified by TMDB.” TMDB developer API ni kwa matumizi yasiyo ya kibiashara; wasiliana na TMDB kuhusu leseni ya matumizi ya kibiashara. Hakuna movie files au unauthorized streaming/download links zinazotolewa.
