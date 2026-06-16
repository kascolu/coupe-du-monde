/**
 * SYNC ENGINE — Netlify Function
 * 
 * Rôle : interroger API-Football toutes les 15min (via Netlify Scheduled Functions)
 *        et écrire les résultats dans Supabase.
 * 
 * Variables d'environnement Netlify requises :
 *   RAPIDAPI_KEY         → clé API-Football sur RapidAPI (gratuite)
 *   SUPABASE_URL         → https://xxxxx.supabase.co
 *   SUPABASE_SERVICE_KEY → clé service_role de Supabase (pas la anon key)
 * 
 * Déclenchement : POST depuis le frontend OU cron Netlify
 */

// ─── Helpers Supabase (sans SDK pour rester léger) ───────────────────────────

async function supabaseUpsert(url, serviceKey, table, rows) {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase upsert error (${table}): ${err}`);
  }
  return res;
}

async function supabaseInsert(url, serviceKey, table, row) {
  await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(row),
  });
}

// ─── Normaliser le statut API-Football ───────────────────────────────────────

function normalizeStatus(short) {
  if (['1H','2H','ET','BT','P','HT','LIVE'].includes(short)) return 'live';
  if (['FT','AET','PEN'].includes(short)) return 'finished';
  return 'upcoming';
}

// ─── Table de correspondance ID interne ↔ noms d'équipe ─────────────────────
// Permet de faire le lien entre l'API externe et nos IDs internes

const TEAM_MATCH_TABLE = {
  'Mexico':          { A: ['m1','m28','m53'] },
  'South Africa':    { A: ['m2'], B: ['m1','m25','m54'] },
  'Korea Republic':  { B: ['m2','m28','m54'] },
  'Czech Republic':  { B: ['m2'], A: ['m25','m53'] },
  'Canada':          { A: ['m3','m27','m49'] },
  'France':          { A: ['m17','m42'], B: ['m61'] },
  'Brazil':          { A: ['m6','m31'], B: ['m51'] },
  'Argentina':       { A: ['m19','m41'], B: ['m72'] },
  'England':         { A: ['m22','m46'], B: ['m67'] },
  'Portugal':        { A: ['m21','m45'], B: ['m69'] },
  'Spain':           { A: ['m13','m37'], B: ['m64'] },
  'Germany':         { A: ['m9','m34'], B: ['m55'] },
  // ... mapping simplifié, le matching par nom d'équipe couvre la plupart des cas
};

// ─── Matching fuzzy nom d'équipe → ID match interne ─────────────────────────

const INTERNAL_MATCHES = [
  {id:'m1',A:'Mexique',B:'Afrique du Sud'},{id:'m2',A:'Corée du Sud',B:'Tchéquie'},
  {id:'m3',A:'Canada',B:'Bosnie-Herzégovine'},{id:'m4',A:'États-Unis',B:'Paraguay'},
  {id:'m5',A:'Qatar',B:'Suisse'},{id:'m6',A:'Brésil',B:'Maroc'},
  {id:'m7',A:'Haïti',B:'Écosse'},{id:'m8',A:'Australie',B:'Turquie'},
  {id:'m9',A:'Allemagne',B:'Curaçao'},{id:'m10',A:'Pays-Bas',B:'Japon'},
  {id:'m11',A:"Côte d'Ivoire",B:'Équateur'},{id:'m12',A:'Suède',B:'Tunisie'},
  {id:'m13',A:'Espagne',B:'Cap-Vert'},{id:'m14',A:'Belgique',B:'Égypte'},
  {id:'m15',A:'Arabie saoudite',B:'Uruguay'},{id:'m16',A:'Iran',B:'Nouvelle-Zélande'},
  {id:'m17',A:'France',B:'Sénégal'},{id:'m18',A:'Irak',B:'Norvège'},
  {id:'m19',A:'Argentine',B:'Algérie'},{id:'m20',A:'Autriche',B:'Jordanie'},
  {id:'m21',A:'Portugal',B:'RD Congo'},{id:'m22',A:'Angleterre',B:'Croatie'},
  {id:'m23',A:'Ghana',B:'Panama'},{id:'m24',A:'Ouzbékistan',B:'Colombie'},
  {id:'m25',A:'Tchéquie',B:'Afrique du Sud'},{id:'m26',A:'Suisse',B:'Bosnie-Herzégovine'},
  {id:'m27',A:'Canada',B:'Qatar'},{id:'m28',A:'Mexique',B:'Corée du Sud'},
  {id:'m29',A:'États-Unis',B:'Australie'},{id:'m30',A:'Écosse',B:'Maroc'},
  {id:'m31',A:'Brésil',B:'Haïti'},{id:'m32',A:'Turquie',B:'Paraguay'},
  {id:'m33',A:'Pays-Bas',B:'Suède'},{id:'m34',A:'Allemagne',B:"Côte d'Ivoire"},
  {id:'m35',A:'Équateur',B:'Curaçao'},{id:'m36',A:'Tunisie',B:'Japon'},
  {id:'m37',A:'Espagne',B:'Arabie saoudite'},{id:'m38',A:'Belgique',B:'Iran'},
  {id:'m39',A:'Uruguay',B:'Cap-Vert'},{id:'m40',A:'Nouvelle-Zélande',B:'Égypte'},
  {id:'m41',A:'Argentine',B:'Autriche'},{id:'m42',A:'France',B:'Irak'},
  {id:'m43',A:'Norvège',B:'Sénégal'},{id:'m44',A:'Jordanie',B:'Algérie'},
  {id:'m45',A:'Portugal',B:'Ouzbékistan'},{id:'m46',A:'Angleterre',B:'Ghana'},
  {id:'m47',A:'Panama',B:'Croatie'},{id:'m48',A:'Colombie',B:'RD Congo'},
  {id:'m49',A:'Suisse',B:'Canada'},{id:'m50',A:'Bosnie-Herzégovine',B:'Qatar'},
  {id:'m51',A:'Écosse',B:'Brésil'},{id:'m52',A:'Maroc',B:'Haïti'},
  {id:'m53',A:'Tchéquie',B:'Mexique'},{id:'m54',A:'Afrique du Sud',B:'Corée du Sud'},
  {id:'m55',A:'Équateur',B:'Allemagne'},{id:'m56',A:'Curaçao',B:"Côte d'Ivoire"},
  {id:'m57',A:'Japon',B:'Suède'},{id:'m58',A:'Tunisie',B:'Pays-Bas'},
  {id:'m59',A:'Turquie',B:'États-Unis'},{id:'m60',A:'Paraguay',B:'Australie'},
  {id:'m61',A:'Norvège',B:'France'},{id:'m62',A:'Sénégal',B:'Irak'},
  {id:'m63',A:'Cap-Vert',B:'Arabie saoudite'},{id:'m64',A:'Uruguay',B:'Espagne'},
  {id:'m65',A:'Égypte',B:'Iran'},{id:'m66',A:'Nouvelle-Zélande',B:'Belgique'},
  {id:'m67',A:'Panama',B:'Angleterre'},{id:'m68',A:'Croatie',B:'Ghana'},
  {id:'m69',A:'Colombie',B:'Portugal'},{id:'m70',A:'RD Congo',B:'Ouzbékistan'},
  {id:'m71',A:'Algérie',B:'Autriche'},{id:'m72',A:'Jordanie',B:'Argentine'},
];

// Dictionnaire de traduction EN → FR pour les noms d'équipe
const EN_TO_FR = {
  'Mexico':'Mexique','South Africa':'Afrique du Sud','Korea Republic':'Corée du Sud',
  'Czech Republic':'Tchéquie','Czechia':'Tchéquie','Bosnia and Herzegovina':'Bosnie-Herzégovine',
  'United States':'États-Unis','USA':'États-Unis','Brazil':'Brésil','Morocco':'Maroc',
  'Haiti':'Haïti','Scotland':'Écosse','Australia':'Australie','Turkey':'Turquie',
  'Germany':'Allemagne','Netherlands':'Pays-Bas','Japan':'Japon','Ivory Coast':'Côte d\'Ivoire',
  "Côte d'Ivoire":"Côte d'Ivoire",'Ecuador':'Équateur','Sweden':'Suède','Tunisia':'Tunisie',
  'Spain':'Espagne','Cape Verde':'Cap-Vert','Saudi Arabia':'Arabie saoudite','Uruguay':'Uruguay',
  'Belgium':'Belgique','Egypt':'Égypte','Iran':'Iran','New Zealand':'Nouvelle-Zélande',
  'France':'France','Senegal':'Sénégal','Iraq':'Irak','Norway':'Norvège',
  'Argentina':'Argentine','Algeria':'Algérie','Austria':'Autriche','Jordan':'Jordanie',
  'Portugal':'Portugal','DR Congo':'RD Congo','Uzbekistan':'Ouzbékistan','Colombia':'Colombie',
  'England':'Angleterre','Croatia':'Croatie','Ghana':'Ghana','Panama':'Panama',
  'Qatar':'Qatar','Switzerland':'Suisse','Canada':'Canada','Curacao':'Curaçao',
};

function translateTeam(name) {
  return EN_TO_FR[name] || name;
}

function findInternalMatch(teamAen, teamBen) {
  const frA = translateTeam(teamAen);
  const frB = translateTeam(teamBen);
  return INTERNAL_MATCHES.find(m =>
    (m.A === frA && m.B === frB) || (m.A === frB && m.B === frA)
  ) || null;
}

// ─── Handler principal ────────────────────────────────────────────────────────

exports.handler = async function (event) {

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  const RAPIDAPI_KEY   = process.env.RAPIDAPI_KEY;
  const SUPABASE_URL   = process.env.SUPABASE_URL;
  const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_KEY;

  if (!RAPIDAPI_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Variables d\'environnement manquantes. Vérifiez RAPIDAPI_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY.' }),
    };
  }

  const startTime = Date.now();
  let updatedCount = 0;

  try {
    // 1. Récupérer les matchs depuis API-Football
    // Coupe du Monde 2026 = league ID 1, saison 2026
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const apiResp = await fetch(
      'https://api-football-v1.p.rapidapi.com/v3/fixtures?league=1&season=2026&timezone=UTC',
      {
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!apiResp.ok) {
      const errText = await apiResp.text();
      throw new Error(`API-Football HTTP ${apiResp.status}: ${errText}`);
    }

    const apiData = await apiResp.json();
    const fixtures = apiData.response || [];

    if (fixtures.length === 0) {
      await supabaseInsert(SUPABASE_URL, SUPABASE_KEY, 'sync_log', {
        provider: 'api-football', matches_updated: 0,
        status: 'ok', message: 'Aucun match retourné — tournoi peut-être pas encore dans l\'API',
      });
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, updated: 0, message: 'Aucun match trouvé dans l\'API' }),
      };
    }

    // 2. Normaliser et matcher avec nos IDs internes
    const rowsToUpsert = [];

    for (const f of fixtures) {
      const homeEN = f.teams?.home?.name;
      const awayEN = f.teams?.away?.name;
      const internal = findInternalMatch(homeEN, awayEN);
      if (!internal) continue; // Match non trouvé dans notre table

      const scoreA = f.goals?.home ?? null;
      const scoreB = f.goals?.away ?? null;
      const status = normalizeStatus(f.fixture?.status?.short || 'NS');
      const minute = f.fixture?.status?.elapsed ?? null;

      // Respecter l'ordre A/B interne (pas forcément home/away de l'API)
      const homeFR = translateTeam(homeEN);
      const isReversed = (internal.A !== homeFR);

      rowsToUpsert.push({
        id: internal.id,
        score_a: isReversed ? scoreB : scoreA,
        score_b: isReversed ? scoreA : scoreB,
        status,
        minute,
        auto_synced: true,
        updated_at: new Date().toISOString(),
      });
    }

    // 3. Upsert vers Supabase (par batch de 20)
    const BATCH = 20;
    for (let i = 0; i < rowsToUpsert.length; i += BATCH) {
      await supabaseUpsert(SUPABASE_URL, SUPABASE_KEY, 'matches', rowsToUpsert.slice(i, i + BATCH));
    }
    updatedCount = rowsToUpsert.length;

    // 4. Logger la sync
    await supabaseInsert(SUPABASE_URL, SUPABASE_KEY, 'sync_log', {
      provider: 'api-football',
      matches_updated: updatedCount,
      status: 'ok',
      message: `${updatedCount} matchs mis à jour en ${Date.now() - startTime}ms`,
    });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        updated: updatedCount,
        total_api: fixtures.length,
        duration_ms: Date.now() - startTime,
      }),
    };

  } catch (err) {
    // Logger l'erreur dans Supabase
    try {
      await supabaseInsert(SUPABASE_URL, SUPABASE_KEY, 'sync_log', {
        provider: 'api-football', matches_updated: 0,
        status: 'error', message: err.message,
      });
    } catch(_) {}

    return {
      statusCode: 502,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
