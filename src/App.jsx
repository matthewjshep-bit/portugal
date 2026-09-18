import { useEffect, useMemo, useRef, useState } from 'react';
import TripMap from './components/TripMap';
import {
  TRIP,
  DAYS,
  PLACES,
  REGIONS,
  CATEGORIES,
  WISHES,
  BOOKINGS,
  LOGISTICS,
  SOURCES,
} from './data/trip';
import './styles.css';

const PLACE_BY_ID = Object.fromEntries(PLACES.map((p) => [p.id, p]));
const CAT_KEYS = Object.keys(CATEGORIES);
const STORE_KEY = 'pt26';

const URGENCY = {
  now: { label: 'Book now', tone: 'hot' },
  soon: { label: 'This week', tone: 'warm' },
  optional: { label: 'Nice to have', tone: 'cool' },
};

function mapsUrl(place) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${place.name} ${place.area || ''} Portugal`,
  )}`;
}

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeStore(next) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    /* private mode — the page still works, it just forgets */
  }
}

function dayPlaceIds(day) {
  const ids = [];
  day.blocks.forEach((block) =>
    block.places.forEach((id) => {
      if (!ids.includes(id)) ids.push(id);
    }),
  );
  return ids;
}

function todayId() {
  const now = new Date();
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  return DAYS.find((d) => d.date === iso)?.id || null;
}

/* ------------------------------------------------------------------ */

function PlaceChip({ place, isActive, isSaved, onFocus, onToggleSave }) {
  const [open, setOpen] = useState(false);
  const cat = CATEGORIES[place.cat];
  const isHome = place.cat === 'stay';

  return (
    <div
      className={`pt-place${isActive ? ' is-active' : ''}${open ? ' is-open' : ''}${isHome ? ' is-home' : ''}`}
    >
      <button type="button" className="pt-place__head" onClick={() => { onFocus(place.id); setOpen((v) => !v); }}>
        <span className="pt-place__dot" style={{ background: cat.color }} aria-hidden="true">
          {cat.pin}
        </span>
        <span className="pt-place__name">
          {place.name}
          {place.wish && (
            <span
              className="pt-place__wish"
              style={{ '--wish': WISHES[place.wish].color }}
              title={`On ${WISHES[place.wish].label}'s list`}
            >
              {WISHES[place.wish].label}
            </span>
          )}
          {place.mustBook && <span className="pt-place__flag" title="Reservation needed">book</span>}
        </span>
        <span className="pt-place__meta">{place.price}</span>
      </button>

      {open && (
        <div className="pt-place__body">
          {place.tag && (
            <span className="pt-place__tag" style={{ borderColor: cat.color, color: cat.color }}>
              {place.tag}
            </span>
          )}
          <p className="pt-place__desc">{place.desc}</p>
          {place.why && (
            <p className="pt-place__why">
              <span>Why it made the list</span>
              {place.why}
            </p>
          )}
          {place.warn && <p className="pt-place__warn">⚠ {place.warn}</p>}
          {place.booking && <p className="pt-place__booking">→ {place.booking}</p>}
          <div className="pt-place__actions">
            <a href={mapsUrl(place)} target="_blank" rel="noreferrer" className="pt-mini">Directions ↗</a>
            <button type="button" className="pt-mini" onClick={() => onFocus(place.id)}>Show on map</button>
            <button
              type="button"
              className={`pt-mini${isSaved ? ' is-on' : ''}`}
              onClick={() => onToggleSave(place.id)}
            >
              {isSaved ? '★ Saved' : '☆ Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function App() {
  const [dayId, setDayId] = useState(() => todayId() || DAYS[0].id);
  const [scope, setScope] = useState('day');
  const [cats, setCats] = useState(() => new Set(CAT_KEYS));
  const [wishOnly, setWishOnly] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [focus, setFocus] = useState({ id: null, n: 0 });
  const [store, setStore] = useState(readStore);
  const railRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => writeStore(store), [store]);

  /* the sticky map sits directly below the sticky day rail, so the offset has
     to track the rail's real height rather than a guessed constant */
  useEffect(() => {
    const rail = railRef.current;
    const root = rootRef.current;
    if (!rail || !root || typeof ResizeObserver === 'undefined') return undefined;
    const sync = () => root.style.setProperty('--rail-h', `${Math.round(rail.offsetHeight)}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(rail);
    return () => ro.disconnect();
  }, []);

  const day = DAYS.find((d) => d.id === dayId) || DAYS[0];
  const today = todayId();
  const dayIds = useMemo(() => dayPlaceIds(day), [day]);

  const regionPlaces = useMemo(
    () => PLACES.filter((p) => p.region === day.region),
    [day.region],
  );
  const hasDayPins = dayIds.length > 0;
  const hasRegionPins = regionPlaces.length > 0;

  /* travel days carry no pins of their own — show the whole route instead of a blank map */
  useEffect(() => {
    if (scope === 'day' && !hasDayPins) setScope(hasRegionPins ? 'region' : 'all');
    if (scope === 'region' && !hasRegionPins) setScope('all');
  }, [scope, hasDayPins, hasRegionPins]);

  const effectiveScope =
    scope === 'day' && !hasDayPins
      ? (hasRegionPins ? 'region' : 'all')
      : scope === 'region' && !hasRegionPins
        ? 'all'
        : scope;

  const visible = useMemo(() => {
    let pool;
    if (effectiveScope === 'day') pool = dayIds.map((id) => PLACE_BY_ID[id]);
    else if (effectiveScope === 'region') pool = regionPlaces;
    else pool = PLACES;
    return pool
      .filter(Boolean)
      .filter((p) => cats.has(p.cat))
      .filter((p) => !wishOnly || p.wish);
  }, [effectiveScope, dayIds, regionPlaces, cats, wishOnly]);

  const focusPlace = (id) => {
    setActiveId(id);
    setFocus((f) => ({ id, n: f.n + 1 }));
    if (effectiveScope === 'day' && id && !dayIds.includes(id)) setScope('all');
  };

  const toggleCat = (key) =>
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next.size ? next : new Set(CAT_KEYS);
    });

  const toggleSave = (id) =>
    setStore((prev) => {
      const saved = { ...(prev.saved || {}) };
      if (saved[id]) delete saved[id];
      else saved[id] = true;
      return { ...prev, saved };
    });

  const toggleBooking = (id) =>
    setStore((prev) => {
      const booked = { ...(prev.booked || {}) };
      if (booked[id]) delete booked[id];
      else booked[id] = true;
      return { ...prev, booked };
    });

  const saved = store.saved || {};
  const booked = store.booked || {};
  const bookedCount = BOOKINGS.filter((b) => booked[b.id]).length;
  const savedPlaces = PLACES.filter((p) => saved[p.id]);

  return (
    <main className="pt" ref={rootRef}>
      {/* ---------------------------------------------------------- hero */}
      <header className="pt-hero">
        <div className="pt-hero__inner">
          <p className="pt-hero__kicker">{TRIP.travellers} · 18—27 September 2026 · 8 nights</p>
          <h1 className="pt-hero__title">
            Portugal<span>.</span>
          </h1>
          <p className="pt-hero__route">
            {['Porto', 'Douro Valley', 'Comporta', 'Lisbon', 'Sintra'].map((leg, i) => (
              <span key={leg}>
                {i > 0 && <em aria-hidden="true">→</em>}
                {leg}
              </span>
            ))}
          </p>
          <p className="pt-hero__blurb">
            Ten days, four bases, one hotel in the dunes. Every restaurant, quinta and beach club
            below was picked on ratings and how often it turns up in the guides — not on how close
            it is to the car park. Tap anything to put it on the map.
          </p>
          <div className="pt-hero__stats">
            <div><strong>{PLACES.length}</strong><span>places researched</span></div>
            <div><strong>{BOOKINGS.filter((b) => b.urgency === 'now').length}</strong><span>to book today</span></div>
            <div><strong>{PLACES.filter((p) => p.wish).length}</strong><span>from your own two lists</span></div>
            <div><strong>{TRIP.stay}</strong><span>Comporta base, 3 nights</span></div>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------- day rail */}
      <nav className="pt-rail" aria-label="Days" ref={railRef}>
        <div className="pt-rail__track">
          {DAYS.map((d) => {
            const region = REGIONS[d.region];
            return (
              <button
                key={d.id}
                type="button"
                className={`pt-railday${d.id === dayId ? ' is-active' : ''}${d.id === today ? ' is-today' : ''}`}
                style={{ '--accent': region.color }}
                onClick={() => { setDayId(d.id); setScope('day'); setActiveId(null); }}
              >
                <span className="pt-railday__num">{d.short}</span>
                <span className="pt-railday__dow">{d.dow.slice(0, 3)}</span>
                <span className="pt-railday__where">{region.label}</span>
                {d.id === today && <span className="pt-railday__today">today</span>}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ----------------------------------------------------------- body */}
      <div className="pt-main">
        <section className="pt-col">
          <article className="pt-day" style={{ '--accent': REGIONS[day.region].color }}>
            <p className="pt-day__date">
              {day.dow}, {new Date(`${day.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
              <em>{REGIONS[day.region].label}</em>
            </p>
            <h2 className="pt-day__title">{day.title}</h2>
            <p className="pt-day__summary">{day.summary}</p>
            {day.warn && <p className="pt-day__warn">⚠ {day.warn}</p>}

            <ol className="pt-blocks">
              {day.blocks.map((block) => (
                <li key={block.time + block.title} className="pt-block">
                  <div className="pt-block__time">{block.time}</div>
                  <div className="pt-block__content">
                    <h3>{block.title}</h3>
                    <p>{block.body}</p>
                    {block.places.length > 0 && (
                      <div className="pt-block__places">
                        {block.places.map((id) => {
                          const place = PLACE_BY_ID[id];
                          if (!place) return null;
                          return (
                            <PlaceChip
                              key={id}
                              place={place}
                              isActive={activeId === id}
                              isSaved={Boolean(saved[id])}
                              onFocus={focusPlace}
                              onToggleSave={toggleSave}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            <div className="pt-day__nav">
              <button
                type="button"
                disabled={DAYS[0].id === day.id}
                onClick={() => { const i = DAYS.findIndex((d) => d.id === day.id); setDayId(DAYS[i - 1].id); setScope('day'); }}
              >
                ← Previous day
              </button>
              <button
                type="button"
                disabled={DAYS[DAYS.length - 1].id === day.id}
                onClick={() => { const i = DAYS.findIndex((d) => d.id === day.id); setDayId(DAYS[i + 1].id); setScope('day'); }}
              >
                Next day →
              </button>
            </div>
          </article>
        </section>

        {/* ------------------------------------------------------- map */}
        <aside className="pt-mapcol">
          <div className="pt-mapcard">
            <div className="pt-mapbar">
              <div className="pt-scope">
                {[
                  { k: 'day', label: 'This day', ok: hasDayPins },
                  { k: 'region', label: REGIONS[day.region].label, ok: hasRegionPins },
                  { k: 'all', label: 'Whole trip', ok: true },
                ].map((s) => (
                  <button
                    key={s.k}
                    type="button"
                    disabled={!s.ok}
                    className={effectiveScope === s.k ? 'is-on' : ''}
                    onClick={() => { setScope(s.k); setActiveId(null); }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <span className="pt-mapbar__count">{visible.length} pins</span>
            </div>

            <TripMap
              places={visible}
              activeId={activeId}
              focusId={focus.id}
              onSelect={setActiveId}
              showRoute={effectiveScope === 'all'}
            />

            <div className="pt-filters">
              <button
                type="button"
                className={`pt-filter pt-filter--wish${wishOnly ? ' is-on' : ''}`}
                onClick={() => setWishOnly((v) => !v)}
                title="Only the places you two picked out"
              >
                <span aria-hidden="true">★</span>
                Your picks
              </button>
              {CAT_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`pt-filter${cats.has(key) ? ' is-on' : ''}`}
                  style={{ '--cat': CATEGORIES[key].color }}
                  onClick={() => toggleCat(key)}
                >
                  <span className="pt-filter__swatch" aria-hidden="true" />
                  {CATEGORIES[key].label}
                </button>
              ))}
            </div>

            <p className="pt-mapnote">
              Pins put you on the right stretch of street or sand. For small beach clubs and quintas,
              tap <strong>Directions</strong> — that searches the name and lands you exactly.
            </p>
          </div>

          {savedPlaces.length > 0 && (
            <div className="pt-savedcard">
              <h3>★ Your shortlist</h3>
              <ul>
                {savedPlaces.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => focusPlace(p.id)}>{p.name}</button>
                    <span style={{ color: REGIONS[p.region].color }}>{REGIONS[p.region].label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {/* ------------------------------------------------------- bookings */}
      <section className="pt-section pt-bookings" id="bookings">
        <div className="pt-section__head">
          <h2>Book these</h2>
          <p>
            Ticked items are remembered on this device. {bookedCount} of {BOOKINGS.length} done.
          </p>
          <div className="pt-progress"><span style={{ width: `${(bookedCount / BOOKINGS.length) * 100}%` }} /></div>
        </div>
        <div className="pt-booklist">
          {['now', 'soon', 'optional'].map((level) => (
            <div key={level} className={`pt-bookgroup pt-bookgroup--${URGENCY[level].tone}`}>
              <h3>{URGENCY[level].label}</h3>
              {BOOKINGS.filter((b) => b.urgency === level).map((b) => {
                const place = b.place ? PLACE_BY_ID[b.place] : null;
                return (
                  <label key={b.id} className={`pt-booking${booked[b.id] ? ' is-done' : ''}`}>
                    <input type="checkbox" checked={Boolean(booked[b.id])} onChange={() => toggleBooking(b.id)} />
                    <span className="pt-booking__box" aria-hidden="true" />
                    <span className="pt-booking__text">
                      <strong>{b.label}</strong>
                      <em>{b.note}</em>
                      {place && (
                        <a href={mapsUrl(place)} target="_blank" rel="noreferrer">
                          Find {place.name} ↗
                        </a>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------ logistics */}
      <section className="pt-section pt-logistics">
        <div className="pt-section__head">
          <h2>Things that will bite you</h2>
          <p>The practical stuff, researched for these exact dates.</p>
        </div>
        <div className="pt-loggrid">
          {LOGISTICS.map((item) => (
            <article key={item.id} className="pt-logcard">
              <span className="pt-logcard__icon" aria-hidden="true">{item.icon}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- sources */}
      <section className="pt-section pt-sources">
        <div className="pt-section__head">
          <h2>Where this came from</h2>
          <p>Guides, Michelin listings and review sets used to build the picks above.</p>
        </div>
        <ul className="pt-sourcelist">
          {SOURCES.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer">{s.label} ↗</a>
            </li>
          ))}
        </ul>
        <p className="pt-foot">
          Opening hours, ticket rules and prices move. Confirm anything time-critical directly with
          the restaurant before you plan a day around it. Boa viagem. ✨
        </p>
      </section>
    </main>
  );
}
