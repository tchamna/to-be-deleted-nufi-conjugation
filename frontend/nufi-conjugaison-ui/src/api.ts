/** Même ordre que api_nufi_conjugation.LOCAL_TENSES */
export const TENSES_FALLBACK: { id: string; title: string }[] = [
  { id: "present-continuous", title: "Présent progressif (maintenant)" },
  { id: "passee-immediat", title: "Passé composé / passé récent" },
  { id: "passee-6h", title: "Passé récent (≈ 6 h)" },
  { id: "passee-hier", title: "Passé d'hier" },
  { id: "passee-au-moins-2-jours", title: "Passé (≥ 2 jours)" },
  { id: "passee-habituel", title: "Passé habituel" },
  { id: "passee-lointain", title: "Passé lointain" },
  { id: "futur-proche", title: "Futur proche" },
  { id: "futur-lointain", title: "Futur lointain" },
  { id: "present-habituel", title: "Présent habituel" },
  { id: "imperatif", title: "Impératif" },
];

const DEFAULT_API =
  "https://nufi-conjugator-esgcebhzepdaejdw.canadacentral-01.azurewebsites.net";

export function getApiBase(): string {
  const v = import.meta.env.VITE_API_BASE?.trim();
  return v || DEFAULT_API;
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export async function fetchJson<T>(path: string): Promise<T> {
  const url = joinUrl(getApiBase(), path);
  let res: Response;
  try {
    res = await fetch(url, { mode: "cors", credentials: "omit" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${msg} — ${url}`);
  }
  const data = (await res.json().catch(() => ({}))) as T & Record<string, unknown>;
  if (!res.ok) {
    const err =
      (data as { error?: string }).error ||
      (data as { detail?: string }).detail ||
      `HTTP ${res.status}`;
    throw new Error(err);
  }
  return data as T;
}

export type TenseItem = { id: string; title: string };

export async function loadTenses(): Promise<TenseItem[]> {
  try {
    const data = await fetchJson<{ tenses?: TenseItem[] }>("/tenses");
    if (Array.isArray(data.tenses) && data.tenses.length > 0) {
      return data.tenses;
    }
  } catch {
    /* fallback */
  }
  return [...TENSES_FALLBACK];
}

export type VerbMeta = {
  verb: string;
  group: string;
  translated_verb: string | null;
};

export async function loadVerbMeta(verb: string): Promise<VerbMeta | null> {
  try {
    return await fetchJson<VerbMeta>(
      `/verb-meta?verb=${encodeURIComponent(verb)}`
    );
  } catch {
    return null;
  }
}

/** Deux / trois listes parallèles (raw JSON) → lignes du tableau (comme _normalize_rows). */
function rowsFromRawParallel(
  raw: unknown,
  tenseId: string
): string[][] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  if (
    tenseId === "present-continuous" ||
    tenseId === "passee-habituel"
  ) {
    if (raw.length < 2) return null;
    const a = raw[0];
    const b = raw[1];
    if (!Array.isArray(a) || !Array.isArray(b)) return null;
    const n = Math.max(a.length, b.length);
    return Array.from({ length: n }, (_, i) => [
      String(a[i] ?? "—").trim() || "—",
      String(b[i] ?? "—").trim() || "—",
    ]);
  }
  if (tenseId === "futur-proche" || tenseId === "futur-lointain") {
    if (raw.length < 3) return null;
    const a = raw[0];
    const b = raw[1];
    const c = raw[2];
    if (!Array.isArray(a) || !Array.isArray(b) || !Array.isArray(c))
      return null;
    const n = Math.max(a.length, b.length, c.length);
    return Array.from({ length: n }, (_, i) => [
      String(a[i] ?? "—").trim() || "—",
      String(b[i] ?? "—").trim() || "—",
      String(c[i] ?? "—").trim() || "—",
    ]);
  }
  return null;
}

/** Réponse actuelle (objet avec rows) ou ancien déploiement (tableau brut). */
export function rowsFromConjugate(
  data: unknown,
  tenseId: string
): string[][] {
  if (data && typeof data === "object" && data !== null) {
    const obj = data as { rows?: unknown; raw?: unknown };
    const rows = obj.rows;
    const fromRaw = rowsFromRawParallel(obj.raw, tenseId);
    if (fromRaw) return fromRaw;
    if (Array.isArray(rows) && rows.length > 0) {
      return rows as string[][];
    }
  }

  if (Array.isArray(data)) {
    if (
      (tenseId === "present-continuous" || tenseId === "passee-habituel") &&
      data.length === 2 &&
      Array.isArray(data[0]) &&
      Array.isArray(data[1])
    ) {
      const a = data[0] as string[];
      const b = data[1] as string[];
      return a.map((cell, i) => [cell, b[i] ?? "—"]);
    }
    if (
      (tenseId === "futur-proche" || tenseId === "futur-lointain") &&
      data.length === 3 &&
      Array.isArray(data[0]) &&
      Array.isArray(data[1]) &&
      Array.isArray(data[2])
    ) {
      const a = data[0] as string[];
      const b = data[1] as string[];
      const c = data[2] as string[];
      const n = Math.max(a.length, b.length, c.length);
      return Array.from({ length: n }, (_, i) => [
        a[i] ?? "—",
        b[i] ?? "—",
        c[i] ?? "—",
      ]);
    }
    if (data.every((x) => typeof x === "string")) {
      return (data as string[]).map((x) => [x]);
    }
    return data.map((row) =>
      Array.isArray(row) ? (row as string[]).map(String) : [String(row)]
    ) as string[][];
  }

  return [["—"]];
}

export async function conjugateOne(
  verb: string,
  tenseId: string
): Promise<string[][]> {
  const path = `/conjugate?verb=${encodeURIComponent(verb)}&tense=${encodeURIComponent(tenseId)}`;
  const data = await fetchJson<unknown>(path);
  return rowsFromConjugate(data, tenseId);
}

/** Même disposition que nufi_conjugation_to_word_document_short (time_groups + fusion colonnes). */
export type WordLayoutGroup = {
  title: string;
  style_key: string;
  word_table_style: string;
  headers: string[];
  rows: string[][];
};

export type ConjugateLayoutResponse = {
  verb: string;
  translated_verb: string | null;
  tone_group?: string | null;
  groups: WordLayoutGroup[];
  table_styles?: Record<string, string>;
};

export async function loadConjugateLayout(
  verb: string
): Promise<ConjugateLayoutResponse | null> {
  try {
    const data = await fetchJson<ConjugateLayoutResponse>(
      `/conjugate-layout?verb=${encodeURIComponent(verb)}`
    );
    if (Array.isArray(data.groups) && data.groups.length > 0) {
      return data;
    }
  } catch {
    /* API sans /conjugate-layout */
  }
  return null;
}

export type WordLayoutMetaGroup = {
  title: string;
  style_key: string;
  word_table_style: string;
  tenses: { id: string; subtitle: string }[];
};

export type WordLayoutResponse = {
  groups: WordLayoutMetaGroup[];
  table_styles: Record<string, string>;
  time_groups?: Record<string, Record<string, string>>;
  resulam_index_to_tense_id?: string[];
};

/** Dérivé de TIME_GROUPS côté API (GET /word-layout). */
export async function loadWordLayoutMeta(): Promise<WordLayoutResponse | null> {
  try {
    return await fetchJson<WordLayoutResponse>("/word-layout");
  } catch {
    return null;
  }
}

const SUBTITLE_NUMBERED_TENSES = new Set([
  "present-continuous",
  "passee-habituel",
]);

export const WORD_DOC_TABLE_STYLES: Record<string, string> = {
  Présent: "Light List Accent 1",
  "Passé Récent": "Light List Accent 2",
  Passé: "Light List Accent 3",
  "Futur Proche": "Light Grid",
  "Futur Lointain": "Light List Accent 4",
  "Temps Habituel": "Light Grid Accent 5",
};

/**
 * Même chose que api_nufi_conjugation.TIME_GROUPS + RESULAM_TIME_INDEX_TO_LOCAL_TENSE_ID.
 * Utilisé si l’API déployée n’a pas encore GET /word-layout (ex. Azure non mis à jour).
 */
const RESULAM_TIME_INDEX_TO_LOCAL_TENSE_ID: readonly string[] = [
  "present-continuous",
  "passee-immediat",
  "passee-6h",
  "passee-hier",
  "passee-au-moins-2-jours",
  "passee-habituel",
  "passee-lointain",
  "futur-proche",
  "futur-lointain",
  "present-habituel",
  "imperatif",
];

const TIME_GROUPS_FALLBACK: [string, [number, string][]][] = [
  ["Présent", [[0, "Présent"], [10, "Impératif"]]],
  ["Passé Récent", [[1, "Passé Composé"], [2, "Passé Récent"]]],
  [
    "Passé",
    [
      [3, "Passé d'hier"],
      [4, "Passé (>= 2 jours)"],
      [6, "Passé Lointain"],
    ],
  ],
  ["Futur Proche", [[7, "Futur Proche"]]],
  ["Futur Lointain", [[8, "Futur Lointain"]]],
  ["Temps Habituel", [[9, "Présent Habituel"], [5, "Passé Habituel"]]],
];

export function wordLayoutMetaFromTimeGroups(): WordLayoutResponse {
  const groups: WordLayoutMetaGroup[] = [];
  for (const [title, pairs] of TIME_GROUPS_FALLBACK) {
    const tenses = pairs.map(([idx, subtitle]) => ({
      id: RESULAM_TIME_INDEX_TO_LOCAL_TENSE_ID[idx],
      subtitle,
    }));
    groups.push({
      title,
      style_key: title,
      word_table_style:
        WORD_DOC_TABLE_STYLES[title] ?? "Light Grid Accent 5",
      tenses,
    });
  }
  return { groups, table_styles: WORD_DOC_TABLE_STYLES };
}

/** Même logique que _merge_word_style_group dans api_nufi_conjugation.py */
export function mergeWordStyleGroup(
  blocks: [string, string][],
  rowsByTense: Record<string, string[][]>
): { headers: string[]; rows: string[][] } {
  const headers: string[] = [];
  let data: string[][] | null = null;

  for (const [tenseId, subtitle] of blocks) {
    let rawRows = rowsByTense[tenseId];
    if (!rawRows?.length) rawRows = [["—"]];
    const maxCols = Math.max(...rawRows.map((r) => r.length), 1);
    const normRows = rawRows.map((r) => {
      const row = r.map((c) => (String(c).trim() ? String(c) : "—"));
      while (row.length < maxCols) row.push("—");
      return row;
    });
    const w = maxCols;
    if (w > 1) {
      if (SUBTITLE_NUMBERED_TENSES.has(tenseId)) {
        for (let i = 0; i < w; i++) headers.push(`${subtitle} ${i + 1}`);
      } else {
        for (let i = 0; i < w; i++) headers.push(subtitle);
      }
    } else {
      headers.push(subtitle);
    }

    if (data === null) {
      data = normRows.map((r) => [...r]);
    } else {
      const accW = data[0]?.length ?? 0;
      const n = Math.max(data.length, normRows.length);
      const merged: string[][] = [];
      for (let i = 0; i < n; i++) {
        const left =
          i < data.length ? [...data[i]] : Array.from({ length: accW }, () => "—");
        const right =
          i < normRows.length
            ? [...normRows[i]]
            : Array.from({ length: w }, () => "—");
        while (left.length < accW) left.push("—");
        while (right.length < w) right.push("—");
        merged.push([...left, ...right]);
      }
      data = merged;
    }
  }

  return { headers, rows: data ?? [["—"]] };
}

/**
 * Tableaux groupés via TIME_GROUPS (script Word). Préfère GET /conjugate-layout ;
 * sinon GET /word-layout + GET /conjugate par temps.
 */
export async function loadGroupedConjugation(
  verb: string
): Promise<ConjugateLayoutResponse> {
  const fromApi = await loadConjugateLayout(verb);
  if (fromApi) return fromApi;

  let layoutMeta = await loadWordLayoutMeta();
  if (!layoutMeta?.groups?.length) {
    layoutMeta = wordLayoutMetaFromTimeGroups();
  }

  const meta = await loadVerbMeta(verb);
  const tone_group =
    meta?.group != null && String(meta.group).length > 0
      ? String(meta.group)
      : "—";

  const rowsByTense: Record<string, string[][]> = {};
  for (const t of TENSES_FALLBACK) {
    try {
      rowsByTense[t.id] = await conjugateOne(verb, t.id);
    } catch {
      rowsByTense[t.id] = [["—"]];
    }
  }

  const wordStyles = layoutMeta.table_styles ?? WORD_DOC_TABLE_STYLES;
  const groups: WordLayoutGroup[] = [];
  for (const gm of layoutMeta.groups) {
    const blocks: [string, string][] = gm.tenses.map((t) => [t.id, t.subtitle]);
    const { headers, rows } = mergeWordStyleGroup(blocks, rowsByTense);
    groups.push({
      title: gm.title,
      style_key: gm.style_key,
      word_table_style:
        gm.word_table_style ??
        wordStyles[gm.title] ??
        "Light Grid Accent 5",
      headers,
      rows,
    });
  }

  return {
    verb,
    translated_verb: meta?.translated_verb ?? null,
    tone_group,
    groups,
    table_styles: wordStyles,
  };
}
