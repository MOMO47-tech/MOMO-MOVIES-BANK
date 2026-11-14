

## Ombi jipya — miaka, filters na download

- [x] **Miaka halisi ya movies:** Kila movie ionyeshe mwaka wake halisi kutoka TMDB `release_date`/`first_air_date` au chanzo kinachoweza kuthibitishwa; usitumie mwaka wa sasa kwa kila movie. Ondoa movie ambazo bado hazijatoka kwenye orodha za kawaida, na usibuni mwaka kwa clip isiyotambulika. *Imekamilika: katalogi inatumia tarehe za TMDB, movies zijazo zimechujwa, miaka ya DJ clips imewekwa, na clip isiyo na mwaka uliothibitishwa imeondolewa.*
- [x] **Filters bila namba:** Genre buttons za Horror, Action, Animation na nyingine ziandike jina tu, zisioneshe namba za mapambo au idadi ya matokeo. *Imekamilika: chips zina majina pekee.*
- [x] **Downloads zisizoidhinishwa:** Usionyeshe `LOCKED` wala disabled download button. Onyesha `DOWNLOAD` pekee pale kuna direct file iliyoidhinishwa; kama hakuna, ficha kitufe na section isiyo na maudhui. *Imekamilika: kitufe kinaonekana tu kwa URL ya faili yenye ruhusa na uthibitisho; bila ruhusa kinafichwa.*

## Ombi jipya — mpangilio wa homepage kama Freystar

- [x] **Shelves za homepage:** Panga homepage kwa mtiririko wa featured movie, Top Rated Movies, Popular Series, Popular Movies, Trending Now, DJ Specials na Complete Movie Catalog. Shelves ziwe mistari ya poster inayosogea pembeni, zikiwa na vichwa na See All zinazofungua category husika. Tumia data ya MOMO/TMDB na clips zilizopo; usinakili assets au movie-data za Freystar. *Imekamilika: shelves hutumia data ya TMDB/MOMO na buttons za See All hufungua katalogi husika.*
- [x] **Katalogi na DJ:** Weka DJ clips katika shelves tofauti kwa creator, kisha kamili movie catalog grid chini yake yenye genre filters. Kadi zionyeshe poster, jina na mwaka sahihi pale unapatikana; play ibaki ndani ya MOMO. Usibuni “Top 10 Today” bila analytics wala kuonyesha download isiyoidhinishwa. *Imekamilika: DJ clips zimepangwa kwa creator; trailer/clip huchezwa ndani ya dialog; grid na filters ziko chini ya shelves.*
- [x] **Mpangilio rahisi/responsive:** Ondoa maelezo yanayojirudia na search-chip panel inayotangulia movie shelves; baki na navigation, search, vichwa, posters na controls zinazosaidia. Layout ifanye kazi vizuri kwenye simu na desktop. *Imekamilika: copy imepunguzwa, featured/search/nav na poster shelves zimetengenezwa responsive.*

## Ombi jipya — filamu kamili za Public Domain / Creative Commons

- [x] Ongeza filamu kamili tu ikiwa chanzo cha mwenye haki kinathibitisha Public Domain au Creative Commons inayoruhusu kushiriki/kupakua; onyesha jina, mwaka, runtime, leseni na chanzo, na usinakili media ya Freystar. *Imekamilika: Sita Sings the Blues (2008) imewekwa kwa CC0 1.0, with source, rights-holder, runtime na mwaka; hakunakiliwa catalog ya Freystar.*
- [x] Kila filamu iliyoidhinishwa iwe na kitufe cha DOWNLOAD kinachoelekeza kwenye faili iliyoidhinishwa; usionyeshe LOCKED au kitufe bandia. *Imekamilika: direct MP4 ya Archive.org inatumika tu kwa record yenye `rights_verified` na `download_authorized`; kadi na player zina DOWNLOAD.*
- [x] DOWNLOAD iweke jina la filamu kwenye My List ya mtumiaji kabla ya kufungua faili; My List ya sasa ni ya browser/device husika. *Imekamilika: taarifa za filamu, leseni na attribution huhifadhiwa kwenye localStorage kwanza; link inafunguka tu ikiwa save imefanikiwa.*
- [x] Filamu ichezwe ndani ya MOMO pale source inaruhusu playback ya browser; Android/website haiwezi kulazimisha faili iingie Gallery. *Imekamilika: MP4 ina player ya inline; link ya nje huendeshwa na browser. Tovuti haiwezi kuamuru Gallery au folder ya simu; dialog inafafanua Downloads/Gallery hutegemea browser na kifaa.*
- [x] Weka masharti ya leseni yanayoathiri filamu husika, ukubwa wa faili, na runtime kabla ya download. *Imekamilika: kadi yenyewe ina attribution na masharti ya soundtrack pamoja na leseni, rightsholder na source links; inaonyesha 82 min na 224 MB.*

**Kikomo cha catalog:** Valkaama haijaongezwa kwa sasa: source rasmi inatoa matoleo makubwa ya MKV ya takriban 4.5 GB, lakini playback ya browser na matoleo yanayofaa kwenye Android hazikuthibitishwa.

## Ombi jipya — upload ya simu na shelf ya DJ Mack

- [x] Admin aweza kuchagua faili `.mp4` kutoka simu kupitia Admin Dashboard, kuona asilimia ya upload, na kutuma faili moja kwa moja kwenye Supabase Storage kwa TUS resumable upload badala ya kuipitisha kwenye Vercel. *Imekamilika: Admin ina phone file-picker, progress, retry/resume flow ya TUS yenye 6 MiB chunks; video haiendi kupitia Vercel body.*
- [x] Upload ipatikane kwa akaunti ya admin pekee kupitia signed token ya muda mfupi; server-role key isitumwe kwa browser. Jina la faili la ndani lisitumike kama jina la umma, na namba za simu kutoka kwenye filename zisichapishwe. *Imekamilika: API hukagua admin session na allow-list kabla ya token ya njia maalum; original filename haitumwi/kuchapishwa; faili hupewa UUID.*
- [x] Kabla ya kuchapisha, admin aweke jina/mwaka, kiungo cha uthibitisho wa haki na maelezo ya ruhusa, kisha athibitishe checkbox ya haki; rekodi iundwe baada tu ya video kupakiwa kikamilifu. *Imekamilika: API hukataa missing metadata/rights confirmation, huhakiki MP4/range/size, halafu ndipo huunda rekodi iliyochapishwa.*
- [x] Video zilizopakiwa zionekane katika shelf ya DJ Mack, zichezwe ndani ya MOMO, na download itumike tu kwa video iliyoidhinishwa; zisionekane kama DJ Mack kabla ya upload kukamilika. *Imekamilika: dynamic library records zenye rights-confirmed marker huingia DJ Mack shelf, HTML5 player na comments; DOWNLOAD ina gate na `?download` ya Supabase, na inaongeza filamu kwenye My List kwanza; shelf na player huruhusu pia kuongeza/kutoa filamu mwenyewe.*
- [x] Dashboard ieleze kuwa video iliyochapishwa inaweza kuonekana hadharani na kuhifadhiwa kwenye storage ya Supabase; ukubwa wa file na gharama/kvota hutegemea mipango na settings za Supabase. *Imekamilika: notice ya public bucket, quota na limits ipo; bucket hujaribu 5 GiB na hutumia limit ndogo inayoruhusiwa na project.*

**Hali ya upload halisi:** Hakukuwa na MP4 ya kutumia kwenye session hii, kwa hiyo upload halisi haikuanza. Admin anaweza kuchagua faili na uthibitisho wa haki kwenye `/admin`; kikomo halisi kinategemea Supabase project.
