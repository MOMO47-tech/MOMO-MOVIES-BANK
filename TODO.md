# TODO — MOMO MOVIES BANK

- [ ] **Landing page ya neon inayosogea:** Tovuti iwe na background nyeusi na kijani cha neon, nyota zinazosogea nyuma, alama ya mviringo inayong'aa, paneli kuu ya maelezo na kitufe cha kuendelea, kwa mtindo wa picha ya mtumiaji.
- [ ] **Fomu ya kuingia:** Mtumiaji aweze kuingiza namba ya simu na nenosiri la pamoja lililotajwa na mmiliki; fomu ihakiki namba na ionyeshe ujumbe wa kosa salama. Nenosiri liwekwe kama secret ya server/Vercel, lisijumuishwe kwenye browser code au repo.
- [ ] **Uanachama na faragha:** Hifadhi uanachama kwa njia inayozuia namba ileile kujiunga mara nyingi; namba za simu zisichapishwe hadharani. Onyesha idadi/jumla ya waliojiunga tu.
- [ ] **Movie discovery catalog:** Onyesha orodha ya filamu yenye posters au fallback ya sanaa, majina na maelezo muhimu; mtumiaji aweze kutafuta na kuvinjari, na kufungua maelezo ya filamu.
- [ ] **Viungo halali vya filamu:** Toa trela au viungo vya huduma halali za kutazama filamu; usiunganishe downloads zisizoidhinishwa.
- [ ] **Vercel na GitHub:** Panga source na deployment configuration kwa Vercel ili ipate domain ya `*.vercel.app`; hifadhi files kwenye repo `MOMO47-tech/MOMO-MOVIES-BANK` na usiweke secrets kwenye repo.

## Ombi jipya

- [x] **Utafutaji wa movies na series:** Marekebisha utafutaji usionyeshe matokeo tupu kwa sababu ya request race; tumia TMDB kupata movies na series za sasa, na onyesha maelekezo yaliyo wazi ikiwa `TMDB_API_KEY` haijawekwa au haifanyi kazi.
- [x] **Tafsiri za DJ wa Tanzania:** Ongeza sehemu inayoonyesha filamu zilizotafsiriwa na DJ maarufu wa Tanzania Ommy DJ, zikionyesha jina la DJ na viungo vya video vilivyochapishwa kwenye channel yake ya YouTube. Viungo viandikwe wazi kuwa ni vipande/trela fupi, si filamu nzima; usiweke full movie au download bila ruhusa ya mwenye haki.
- [x] **Download:** Ongeza sehemu ya Download inayoonekana wazi; direct download itumike tu kwa link rasmi iliyoidhinishwa na mwenye haki, vinginevyo elekeza kwenye app/platform rasmi kwa offline save ikiwa inaruhusu. Sehemu inaeleza kwamba hakuna direct file iliyothibitishwa na inaelekeza offline save kwenye app yenye haki.

## Ombi la sasa

- [x] **Movies mpya za mwaka huu:** Kitufe cha “Mpya” kionyeshe movies zilizotolewa ndani ya mwaka wa sasa, mwaka ukihesabiwa kwa saa za Tanzania na movies zikiwa zimepangwa kutoka zilizotoka karibuni kwenda zamani.
- [x] **Maarufu zinazo-trend:** Kitufe cha “Maarufu” kionyeshe movies na series zote zinazotrend, si movies pekee.
- [x] **Kutazama movie nzima na downloads:** Maelezo ya movie yaonyeshe huduma rasmi za kutazama inapopatikana; download ionekane tu ikiwa mwenye haki ametoa download rasmi. Site isihosti wala kuunganisha nakala zisizoidhinishwa.
- [x] **Tafsiri za DJ wa Tanzania:** Sehemu inaonyesha filamu nne zilizotafsiriwa na Ommy DJ (INFILTRATION, WOLF WARRIOR, LAND OF BAD na BLACK SITE) kupitia vipande fupi vilivyowekwa kwenye channel ya Ommy Dj Production. Viungo vifungue vipande hivyo kwenye YouTube; site ieleze kuwa si filamu nzima, na isiweke link ya download au kudai kuwa haki za filamu nzima zimethibitishwa.

## Ombi jipya — DJ catalog na hacker branding

- [x] **Katalogi ya DJs:** Kagua na uweke sehemu za DJ Mack, Babu DJ, DJ Prabhat, Remmy DJ, Murphy DJ, DJ Mjukuu, DJ Bryton, Juma Khan, DJ Skills na DJ Six Fingers. Onyesha jina la DJ na links za chanzo cha DJ au platform rasmi tu; ikiwa utambulisho/channel haujathibitishwa, eleza hilo badala ya kubuni film au link.
- [x] **Full movies, seasons, playback na download:** Onyesha full film/season, player au download tu pale jukwaa rasmi la distributor/rights-holder au leseni iliyo wazi imethibitishwa. YouTube upload, paywall, app listing au malipo peke yake si uthibitisho wa haki. Isipokuwa hivyo, usihosti/kuunganisha full movie au download; tumia profile au clips fupi zilizochapishwa kwenye channel ya DJ na uziweke lebo wazi kuwa si filamu nzima.
- [x] **Hacker-style MOMO MOVIES branding:** Andika “MOMO MOVIES” kwa wordmark ya ki-hacker/neon yenye urembo unaosomeka, nafasi/typography zilizopangwa vizuri na animation ya maandishi; nyota za nyuma ziendelee kusogea na radi/flash za neon zipige nyuma ya maandishi bila kufunika content. Hifadhi usomaji kwenye simu na uzingatie reduced-motion.


## Ombi la sasa — Termux style na genre filters

- [x] **Maandishi ya Termux yenye rangi:** Panga maandishi kwa font ya monospace ya terminal, rangi za neon na accents zinazoonekana kwa utaratibu; neno MOMO MOVIES libaki linasomeka.
- [x] **Aina za filamu:** Tenganisha na weka filters zinazofanya kazi kwa Horror, Action/Mapigano, na Animation/Cartoon.
- [x] **List ya DJs wenye content:** Orodha ionyeshe tu DJ ambaye ana clip au title inayoonekana kwenye catalog; ondoa profile ya DJ ambaye content yake haionekani.
- [x] **Sehemu ya download:** Ongeza sehemu ya Download inayoonekana wazi; direct download itumike tu kwa link rasmi iliyoidhinishwa na mwenye haki, vinginevyo elekeza kwenye app/platform rasmi kwa offline save ikiwa inaruhusu.
- [x] **Radi na nyota:** Radi za neon zionekane wazi zaidi nyuma ya nyota zinazosogea, bila kufunika text au kuharibu usomaji kwenye simu.

## Ombi jipya — Player ya ndani na admin dashboard

- [ ] **Playback ndani ya tovuti:** Mtu akiplay movie, ijiplay palepale na isimpeleke kwenye ukurasa wa matokeo ya YouTube. Trela inaweza ku-embed ndani ya MOMO; filamu nzima huchezwa tu ikiwa admin ameweka chanzo cha player na kuthibitisha ruhusa za kusambaza.
- [ ] **Dashibodi ya admin:** Weka admin dashboard ya kuongeza, kuhariri, kuchapisha/kuficha na kufuta movie au series. Linda dashboard na Supabase Auth pamoja na allow-list ya admin; passcode ya pamoja ya wageni isitumike kama role ya admin. Rekodi ya kuchapishwa lazima iwe na kiungo cha player, chanzo cha uthibitisho wa haki, maelezo ya ruhusa na uthibitisho wa admin; wageni waone na kucheze ndani ya ukurasa rekodi zilizochapishwa na kuthibitishwa pekee.


## Ombi jipya — English terminal gate na community counter

- [x] **Join/access copy ya Termux kwa Kiingereza:** Gate ya kuingia ionyeshe lugha ya Kiingereza kwa PHONE NUMBER, UNLOCK CODE, maelezo, ujumbe na kitufe; iwe na maandishi ya kipekee ya terminal/hacker huku MOMO MOVIES ikibaki wazi na inasomeka.
- [x] **Kaunta ya waliojiunga:** Onyesha jumla ya members kwa namba iliyopangwa kwa koma na lebo ya Kiingereza inayoeleweka; ibaki dark-web/terminal style, ionyeshe hali ya kaunta inapopatikana au isipopatikana, na isitoe namba za simu.
- [x] **Nyota na radi zaidi:** Ongeza msongamano wa nyota na idadi ya radi zinazo-flash kwa nyuma; zisifunike wala kuzuia usomaji, ziwe nyepesi kwa simu, na heshimu `prefers-reduced-motion`.
