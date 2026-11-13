# TODO — MOMO MOVIES BANK

## Uanachama, faragha na catalog

- [x] **Gate na uanachama:** Mtumiaji aingize namba ya simu na nenosiri la pamoja; nenosiri lihifadhiwe kama secret ya server/Vercel, lisionekane kwenye browser code au repo. Zuia kujiunga kwa namba ileile zaidi ya mara moja, usionyeshe namba hadharani, na onyesha jumla ya waliojiunga tu.
- [x] **Movie discovery na utafutaji:** Onyesha movies na series zenye poster/fallback, jina, maelezo na mwaka; mtumiaji aweze kutafuta, kuvinjari na kufungua maelezo. Tumia TMDB API, ikiwemo movies na series zinazotrend pamoja, na onyesha ujumbe unaoeleweka huduma/key inapokosekana.

## Katalogi, categories na playback/download

- [x] **Mwaka wa kutolewa:** Kila movie/series ionyeshe mwaka kutoka release date yake halisi; usiweke mwaka wa sasa kwa titles zote.
- [x] **Kategorii:** Weka Trending, Mpya, Horror, Action/Mapigano na Animation/Cartoon; Horror, Action na Animation/Cartoon zionyeshwe bila namba/counts na filters zake zionyeshe matokeo yanayolingana.
- [x] **My List:** Mtumiaji aweze kuhifadhi/kuondoa movie au series kwa kitufe kwenye card, kuona zilizo kwenye My List kupitia nav, na list ionekane mara moja bila kuomba catalog nyingine. Iandike wazi kuwa orodha inahifadhiwa kwenye browser/kifaa hicho tu.
- [x] **Titles kutoka reference:** Onyesha majina yaliyoonekana kwenye Top 10 ya FreyStar kama quick searches; kubonyeza jina kutafute metadata halisi kupitia TMDB. Usinakili video/posters au kuonyesha madai ya DJ, mwaka, quality, full episodes au download bila verification.
- [x] **PLAY ndani ya MOMO:** Kubonyeza movie card au PLAY ya hero kufungue trela/player ndani ya MOMO; DJ clips pia zicheze ndani ya modal bila kumpeleka mtumiaji moja kwa moja YouTube.
- [ ] **Pakua au tazama kwa lebo sahihi:** “PAKUA FAILI” ianzishe upakuaji tu pale direct `.mp4`/`.webm` file URL, ruhusa ya kupakua na haki za mwenye maudhui vimethibitishwa. Katalogi ya TMDB, YouTube, BBC iPlayer, Prime Video, au ukurasa mwingine wa kutazama usipewe button ya DOWNLOAD; uonyeshwe kama “TAZAMA CHANZO RASMI” tofauti. Download station isi-open provider page ikibonyezwa ikiwa hakuna faili lililoidhinishwa; izime kitufe na ieleze sababu. Kwa sasa catalog haina direct movie files zilizothibitishwa, hivyo hakuna full-movie download inayowezeshwa.

## Tafsiri za DJs wa Tanzania

- [x] **Majina na sources:** Jumuisha DJ Mack, Babu DJ, DJ Prabhat, Remmy DJ, Murphy DJ, DJ Mjukuu, DJ Bryton, Juma Khan, DJ Skills na DJ Six Fingers; tumia links za profile/chanzo rasmi tu, na onyesha wazi ikiwa clip au source bado haijathibitishwa.
- [x] **Clips na full movies:** Cheza clips fupi zilizowekwa hadharani ndani ya MOMO na ziweke lebo kuwa si movie nzima. Full movie/season au download huongezwa tu pale embedding/distribution permission imethibitishwa na admin; YouTube upload, paywall au app listing peke yake si uthibitisho wa haki.
- [x] **Mpangilio wa clips:** Panga clips za DJ zilizopo kwa shelves zenye poster/cover, jina, DJ, maelezo ya chanzo na kitufe cha PLAY ndani ya ukurasa. Tumia “PAKUA FAILI” kwa file iliyoidhinishwa tu; links za kutazama channel/provider ziandikwe “TAZAMA CHANZO RASMI” na ziwe tofauti. Usinakili files, images au links zisizo na ruhusa.

## Usimamizi, comments na muonekano

- [x] **Approved library/admin:** Admin dashboard ilinde kwa Supabase Auth na allow-list, si passcode ya wageni. Admin aweze kuongeza, kuhariri, kuchapisha/kuficha na kufuta movie/series; rekodi iliyochapishwa iwe na player URL, chanzo cha uthibitisho wa haki, maelezo ya ruhusa na admin aliyethibitisha. Wageni waone/cheze rekodi zilizochapishwa na kuthibitishwa pekee.
- [x] **Maoni ya members:** Maoni yahusishwe na movie, yaonekane kwa members walioingia bila kufichua namba za simu, yaepuke HTML/XSS, yathibitishe origin/session na yatumiwe kupitia API/RLS badala ya browser roles kusoma/kuandika jedwali moja kwa moja. Admin aliye kwenye allow-list aweze kuona orodha ya karibuni, kutafuta/kuchuja na kusasisha bila kuona phone/hash.
- [x] **MOMO hacker style na urahisi:** Tumia background nyeusi, neon green, nyota zinazosogea, radi zinazoonekana bila kufunika text, font za Termux/mono na wordmark ya “MOMO MOVIES” inayosomeka. Punguza labels/counts/maneno ya ziada, tumia Kiswahili kwenye UI, hakikisha mpangilio wa simu na heshimu `prefers-reduced-motion`.

## Repo na deployment

- [x] **GitHub/Vercel:** Hifadhi mabadiliko kwenye `MOMO47-tech/MOMO-MOVIES-BANK` branch `feature/momo-movies-bank`, usiweke secrets kwenye repo, na hakikisha deployment iliyosasishwa inafika kwenye domain `momo-movies-peach.vercel.app`.
