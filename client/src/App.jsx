import { useEffect, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { api } from './services/api.js';

const difficulties = [
  { name: 'Easy', suspects: 3, clues: 5, hints: 2, points: 100 },
  { name: 'Medium', suspects: 4, clues: 7, hints: 3, points: 150 },
  { name: 'Hard', suspects: 5, clues: 9, hints: 3, points: 200 },
];

function Shell({ children }) {
  return <div className="min-h-screen bg-[#101720] text-slate-100"><header className="border-b border-white/10"><nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><Link to="/" className="font-bold tracking-wide text-amber-300">AI MYSTERY ROOM</Link><span className="text-xs uppercase tracking-[0.2em] text-slate-400">A case awaits</span></nav></header>{children}</div>;
}

function Home() {
  return <Shell><main className="mx-auto max-w-6xl px-5 py-16 sm:py-24"><div className="max-w-3xl"><p className="text-sm uppercase tracking-[0.3em] text-amber-300">Your next great deduction</p><h1 className="mt-5 text-5xl font-bold leading-tight sm:text-7xl">Every clue has a story.</h1><p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">Create a mystery, follow the evidence, and decide who you believe is telling the truth.</p><Link to="/create" className="mt-9 inline-flex rounded-lg bg-amber-300 px-6 py-3 font-semibold text-slate-950 hover:bg-amber-200">Create Mystery <span aria-hidden="true" className="ml-3">→</span></Link></div><section className="mt-20 grid gap-5 md:grid-cols-2"><article className="rounded-2xl border border-white/10 bg-white/[0.03] p-7"><p className="text-sm uppercase tracking-[0.2em] text-amber-300">How to play</p><h2 className="mt-3 text-2xl font-semibold">Follow the evidence</h2><p className="mt-3 leading-7 text-slate-300">Choose a difficulty, reveal clues one at a time, and use limited hints when you need a nudge. Make one accusation when you are ready.</p></article><article className="rounded-2xl border border-white/10 bg-white/[0.03] p-7"><p className="text-sm uppercase tracking-[0.2em] text-amber-300">Three ways to investigate</p><div className="mt-4 grid grid-cols-3 gap-3">{difficulties.map((item) => <div key={item.name} className="rounded-xl bg-slate-900 p-4"><h3 className="font-semibold">{item.name}</h3><p className="mt-2 text-sm text-slate-400">{item.suspects} suspects<br />{item.clues} clues<br />{item.hints} hints</p></div>)}</div></article></section></main></Shell>;
}

function CreateMystery() {
  const navigate = useNavigate();
  const [premise, setPremise] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const cleanPremise = premise.trim();
    if (!cleanPremise) return setError('Enter a premise to build your mystery.');
    if (cleanPremise.length > 500) return setError('Keep your premise to 500 characters or fewer.');
    setLoading(true); setError('');
    try { const { case: created } = await api.createCase({ premise: cleanPremise, difficulty }); navigate(`/case/${created.id}`); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }
  return <Shell><main className="mx-auto max-w-3xl px-5 py-12 sm:py-16"><Link to="/" className="text-sm text-amber-300 hover:underline">← Home</Link><h1 className="mt-6 text-4xl font-bold">Set the scene</h1><p className="mt-3 text-slate-300">Give your case a starting point. The investigation will take it from there.</p><form onSubmit={submit} className="mt-9 space-y-7 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8"><label className="block"><span className="font-medium">Mystery premise</span><textarea className="mt-3 min-h-36 w-full rounded-xl border border-slate-700 bg-slate-950 p-4 leading-6 outline-none focus:border-amber-300" maxLength={500} value={premise} onChange={(event) => setPremise(event.target.value)} placeholder="A rare painting vanishes during a private gallery opening..." /><span className="mt-2 block text-right text-xs text-slate-400">{premise.length}/500 characters</span></label><fieldset><legend className="font-medium">Choose a difficulty</legend><div className="mt-3 grid gap-3 sm:grid-cols-3">{difficulties.map((item) => <label key={item.name} className={`cursor-pointer rounded-xl border p-4 ${difficulty === item.name ? 'border-amber-300 bg-amber-300/10' : 'border-slate-700 bg-slate-950'}`}><input type="radio" className="sr-only" name="difficulty" value={item.name} checked={difficulty === item.name} onChange={() => setDifficulty(item.name)} /><span className="font-semibold">{item.name}</span><span className="mt-2 block text-sm text-slate-400">{item.suspects} suspects · {item.clues} clues · {item.hints} hints</span></label>)}</div></fieldset>{error && <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}<button disabled={loading} className="rounded-lg bg-amber-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-60">{loading ? 'Building your case…' : 'Generate Mystery'}</button></form></main></Shell>;
}

function Investigation() {
  const { id } = useParams();
  const [game, setGame] = useState(null);
  const [revealed, setRevealed] = useState({});
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [accuseOpen, setAccuseOpen] = useState(false);
  const [selectedSuspect, setSelectedSuspect] = useState('');
  const navigate = useNavigate();
  async function refresh() {
    try { const { case: current } = await api.getCase(id); setGame(current); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, [id]);
  useEffect(() => { if (game?.status === 'completed') navigate(`/case/${id}/result`); }, [game?.status, id, navigate]);
  async function discover(clueId) {
    setBusy(true); setError('');
    try { const result = await api.discoverClue(id, clueId); setRevealed((old) => ({ ...old, [clueId]: result.clue })); await refresh(); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  async function requestHint() {
    setBusy(true); setError('');
    try { const result = await api.getHint(id); setHint(result.hint); await refresh(); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  async function submitAccusation(event) {
    event.preventDefault();
    if (!selectedSuspect || busy) return;
    setBusy(true); setError('');
    try { await api.accuse(id, selectedSuspect); navigate(`/case/${id}/result`); }
    catch (requestError) { setError(requestError.message); setBusy(false); }
  }
  if (loading) return <Shell><main className="mx-auto max-w-5xl px-5 py-16 text-slate-300">Loading case…</main></Shell>;
  if (!game) return <Shell><main className="mx-auto max-w-3xl px-5 py-16"><p role="alert" className="text-rose-200">{error || 'Case unavailable.'}</p><Link to="/create" className="mt-5 inline-block text-amber-300 underline">Create a new case</Link></main></Shell>;
  return <Shell><main className="mx-auto max-w-6xl px-5 py-10"><p className="text-xs uppercase tracking-[0.25em] text-amber-300">{game.difficulty} case · {game.discoveredClueCount}/{game.clues.length} clues discovered</p><h1 className="mt-3 text-4xl font-bold">{game.title}</h1><p className="mt-4 max-w-3xl leading-7 text-slate-300">{game.summary}</p>{error && <p role="alert" className="mt-5 rounded-lg bg-rose-950/50 p-3 text-rose-200">{error}</p>}<div className="mt-9 grid gap-8 lg:grid-cols-[1fr_300px]"><section><h2 className="text-2xl font-semibold">Clues</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{game.clues.map((clue, index) => <article key={clue.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-5"><p className="text-xs uppercase tracking-wider text-slate-500">Evidence {String(index + 1).padStart(2, '0')}</p><h3 className="mt-2 font-semibold">{clue.title}</h3>{revealed[clue.id] ? <p className="mt-3 text-sm leading-6 text-slate-300">{revealed[clue.id].text}</p> : <><p className="mt-2 text-sm text-slate-400">{clue.teaser}</p><button disabled={busy || game.status !== 'active'} onClick={() => discover(clue.id)} className="mt-4 text-sm font-semibold text-amber-300 hover:underline disabled:opacity-50">Discover clue →</button></>}</article>)}</div></section><aside className="space-y-5"><section className="rounded-xl border border-white/10 bg-white/[0.03] p-5"><h2 className="text-lg font-semibold">Persons of interest</h2><div className="mt-4 space-y-4">{game.suspects.map((suspect) => <div key={suspect.id} className="border-t border-white/10 pt-3"><h3 className="font-medium">{suspect.name}</h3><p className="mt-1 text-sm text-slate-400">{suspect.description}</p><p className="mt-2 text-xs text-slate-500">Motive: {suspect.motive}<br />Alibi: {suspect.alibi}</p></div>)}</div></section><section className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-5"><h2 className="font-semibold">Need a nudge?</h2><p className="mt-1 text-sm text-slate-300">{game.hintsRemaining} hint{game.hintsRemaining === 1 ? '' : 's'} remaining</p>{hint && <p className="mt-3 rounded-lg bg-slate-950/70 p-3 text-sm text-amber-100">{hint}</p>}<button disabled={busy || !game.hintsRemaining || game.status !== 'active'} onClick={requestHint} className="mt-4 w-full rounded-lg border border-amber-300/50 px-4 py-2 text-sm font-semibold text-amber-200 disabled:opacity-50">Request a hint</button></section><button disabled={game.status !== 'active'} onClick={() => setAccuseOpen(true)} className="w-full rounded-lg bg-amber-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">Make an accusation</button></aside></div>
    {accuseOpen && <div className="fixed inset-0 z-10 grid place-items-center bg-black/70 p-4"><form onSubmit={submitAccusation} className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6"><h2 className="text-2xl font-bold">Who did it?</h2><p className="mt-2 text-sm text-slate-300">Your accusation is final. Review your choice before submitting.</p><div className="mt-5 space-y-2">{game.suspects.map((suspect) => <label key={suspect.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700 p-3"><input type="radio" name="accused" value={suspect.id} checked={selectedSuspect === suspect.id} onChange={() => setSelectedSuspect(suspect.id)} /><span>{suspect.name}</span></label>)}</div>{error && <p role="alert" className="mt-4 text-sm text-rose-200">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setAccuseOpen(false)} disabled={busy} className="rounded-lg border border-slate-600 px-4 py-2">Cancel</button><button disabled={!selectedSuspect || busy} className="rounded-lg bg-amber-300 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">{busy ? 'Submitting…' : 'Confirm accusation'}</button></div></form></div>}
  </main></Shell>;
}

function Results() {
  const { id } = useParams();
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.getResult(id).then(({ result: data }) => setResult(data)).catch((requestError) => setError(requestError.message)); }, [id]);
  return <Shell><main className="mx-auto max-w-3xl px-5 py-14">{result ? <><p className="text-xs uppercase tracking-[0.25em] text-amber-300">Case closed</p><h1 className="mt-3 text-4xl font-bold">{result.correct ? 'A sharp deduction.' : 'The evidence led elsewhere.'}</h1><p className="mt-4 text-lg text-slate-300">{result.correct ? `You identified ${result.culprit?.name}.` : `${result.culprit?.name} was responsible.`}</p><section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6"><h2 className="text-xl font-semibold">What happened</h2><p className="mt-3 leading-7 text-slate-300">{result.explanation}</p><h3 className="mt-6 font-semibold">Key evidence</h3><ul className="mt-3 space-y-3">{result.supportingClues.map((clue) => <li key={clue.id} className="rounded-lg bg-slate-950/70 p-4"><span className="font-medium">{clue.title}</span><span className="mt-1 block text-sm leading-6 text-slate-400">{clue.text}</span></li>)}</ul></section><section className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/[0.06] p-6"><p className="text-sm uppercase tracking-wider text-amber-200">Final score</p><p className="mt-2 text-5xl font-bold">{result.finalScore}</p><p className="mt-3 text-sm text-slate-300">{result.scoreBreakdown.baseScore} base + {result.scoreBreakdown.cluePoints} clue points − {result.scoreBreakdown.hintPenalty} hint penalty</p></section><Link to="/create" className="mt-7 inline-flex rounded-lg bg-amber-300 px-5 py-3 font-semibold text-slate-950">Play Again</Link></> : <><h1 className="text-3xl font-bold">{error ? 'Results unavailable' : 'Opening the case file…'}</h1>{error && <><p role="alert" className="mt-3 text-rose-200">{error}</p><Link to={`/case/${id}`} className="mt-5 inline-block text-amber-300 underline">Return to investigation</Link></>}</>}</main></Shell>;
}

function NotFound() { return <Shell><main className="mx-auto max-w-3xl px-5 py-16"><h1 className="text-3xl font-bold">Page not found</h1><Link to="/" className="mt-4 inline-block text-amber-300 underline">Return home</Link></main></Shell>; }

export default function App() {
  return <Routes><Route path="/" element={<Home />} /><Route path="/create" element={<CreateMystery />} /><Route path="/case/:id" element={<Investigation />} /><Route path="/case/:id/result" element={<Results />} /><Route path="*" element={<NotFound />} /></Routes>;
}
