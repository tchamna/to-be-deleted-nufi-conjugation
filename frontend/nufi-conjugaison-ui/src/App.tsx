import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadGroupedConjugation,
  loadVerbMeta,
  type ConjugateLayoutResponse,
} from "./api";
import {
  applyClafricaMapping,
  finalizeClafricaInput,
} from "./clafricaMapping";
import "./App.css";

const CLAFRICA_STORAGE_KEY = "nufi-clafrica-enabled";
/** Two Shift key presses within this window toggle Clafrica (global shortcut). */
const DOUBLE_SHIFT_MS = 420;

const PAYPAL_DONATE_URL =
  "https://www.paypal.com/donate?token=pKEy6Z1z9YprzcoshaYw9WR113DjH4AZ7sOW5FflLj2-b0jooeH6VfmKY0iORgCLmszYaPCrKpkRxeWc";

const GRAMMAIRE_BAMILEKE_NUFI_URL = "http://bit.ly/grammaire_bamileke_nufi";

/** Same names as Word built-ins in `nufi_conjugation_to_word_document_short.tense_style_mapping`. */
function wordTableStyleToAttr(style: string | undefined): string {
  const s = (style ?? "Light Grid Accent 5").trim().toLowerCase();
  return s.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function App() {
  const [verb, setVerb] = useState("");
  const [clafricaEnabled, setClafricaEnabled] = useState(() => {
    try {
      return typeof localStorage !== "undefined" &&
        localStorage.getItem(CLAFRICA_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metaLine, setMetaLine] = useState<string | null>(null);
  const [wordLayout, setWordLayout] = useState<ConjugateLayoutResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const lastShiftDownRef = useRef(0);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        if (e.repeat) return;
        const now = Date.now();
        if (
          lastShiftDownRef.current > 0 &&
          now - lastShiftDownRef.current < DOUBLE_SHIFT_MS
        ) {
          e.preventDefault();
          setClafricaEnabled((v) => !v);
          lastShiftDownRef.current = 0;
        } else {
          lastShiftDownRef.current = now;
        }
        return;
      }
      lastShiftDownRef.current = 0;
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CLAFRICA_STORAGE_KEY, clafricaEnabled ? "1" : "0");
    } catch {
      /* private mode */
    }
  }, [clafricaEnabled]);

  const onVerbChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (!clafricaEnabled) {
        setVerb(raw);
        return;
      }
      setVerb(
        applyClafricaMapping(raw, { preserveAmbiguousTrailingToken: true })
      );
    },
    [clafricaEnabled]
  );

  const onVerbBlur = useCallback(() => {
    if (!clafricaEnabled) return;
    setVerb((v) => finalizeClafricaInput(v));
  }, [clafricaEnabled]);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const v = (clafricaEnabled ? finalizeClafricaInput(verb) : verb).trim();
      if (!v) {
        setError("Entrez un verbe.");
        return;
      }
      setLoading(true);
      setError(null);
      setMetaLine(null);
      setWordLayout(null);

      try {
        const meta = await loadVerbMeta(v);
        if (meta) {
          const gloss = meta.translated_verb ?? "—";
          setMetaLine(`${meta.verb} : ${gloss} · groupe tonal ${meta.group}`);
        }
        const layout = await loadGroupedConjugation(v);
        setWordLayout(layout);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [verb, clafricaEnabled]
  );

  return (
    <div className="app">
      <section className="hero">
        <h1>Conjugaison Nufi</h1>
        <form className="controls" onSubmit={onSubmit}>
          <div
            className="clafrica-switch-row"
            title="Raccourcis Clafrica (af, eu, …). Double Maj pour activer / désactiver."
          >
            <span className="clafrica-switch-label" id="clafrica-switch-label">
              Clafrica
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={clafricaEnabled}
              aria-labelledby="clafrica-switch-label"
              disabled={!ready}
              className={`clafrica-switch ${clafricaEnabled ? "clafrica-switch--on" : ""}`}
              onClick={() => setClafricaEnabled((v) => !v)}
            >
              <span className="clafrica-switch-track" aria-hidden>
                <span className="clafrica-switch-thumb" />
              </span>
            </button>
          </div>
          <input
            value={verb}
            onChange={onVerbChange}
            onBlur={onVerbBlur}
            placeholder="Ex. ndēn, mbhí, ndɑ́'sí …"
            autoComplete="off"
            aria-label="Verbe"
            disabled={!ready}
          />
          <button type="submit" disabled={loading || !ready}>
            {loading ? "…" : "Conjuguer"}
          </button>
        </form>
        <div className="hero-support">
          <a
            className="paypal-support-link"
            href={PAYPAL_DONATE_URL}
            target="_blank"
            rel="noopener noreferrer sponsored"
            title="Ouvrir la page de don PayPal"
          >
            <img
              className="paypal-support-img"
              src="https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif"
              alt="Faire un don avec PayPal"
              width="122"
              height="47"
              decoding="async"
            />
            <span className="paypal-support-label">PayPal — soutenir le projet</span>
          </a>
        </div>
        {error ? <p className="status-err">{error}</p> : null}
        {metaLine && !loading ? <p className="meta">{metaLine}</p> : null}
      </section>

      <section className="grid word-doc-layout" aria-live="polite">
        {wordLayout
          ? wordLayout.groups.map((g, i) => {
              const n = Math.max(1, g.headers.length);
              return (
                <article key={i} className="card word-group">
                  <div className="conj-table-caption">
                    {wordLayout.verb} · Groupe {wordLayout.tone_group ?? "—"}
                  </div>
                  <div
                    className="conj-table-shell"
                    data-word-style={wordTableStyleToAttr(g.word_table_style)}
                  >
                    <table
                      className="conj-word"
                      data-word-style={wordTableStyleToAttr(g.word_table_style)}
                    >
                      <thead>
                        <tr>
                          <th className="conj-th-main" colSpan={n}>
                            {g.title}
                          </th>
                        </tr>
                        <tr>
                          {(g.headers.length ? g.headers : ["—"]).map(
                            (h, hi) => (
                              <th key={hi}>{h}</th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.length === 0 ? (
                          <tr>
                            <td className="muted" colSpan={n}>
                              —
                            </td>
                          </tr>
                        ) : (
                          g.rows.map((row, ri) => (
                            <tr key={ri}>
                              {row.map((cell, ci) => (
                                <td key={ci}>{cell || "—"}</td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </article>
              );
            })
          : null}
      </section>

      <footer className="site-footer">
        <p>
          Cette conjugaison est basée sur l&apos;étude détaillée de la conjugaison
          en langue fe&apos;efe&apos;e, tirée du livre &apos;La grammaire des
          langues bamilékés&nbsp;: cas du nùfi&apos;.{" "}
          <a
            href={GRAMMAIRE_BAMILEKE_NUFI_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {GRAMMAIRE_BAMILEKE_NUFI_URL}
          </a>
        </p>
      </footer>
    </div>
  );
}
