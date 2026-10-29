import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import './styles.css';

const socket = io({ autoConnect: false, reconnection: true });
const SESSION_KEY = 'popsala-session';
const QUIZ_NAME = 'Trigo';
const QUIZ_PATH = '/trigo';
const getStored = key => { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } };
const setStored = (key, value) => { try { value === null ? sessionStorage.removeItem(key) : sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Current connection still works without storage. */ } };
const secs = ms => `${(ms / 1000).toFixed(3)} s`;
const shortCode = value => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function BrandLogo() {
  return <a className="brand" href="/" aria-label="JKA games — todos os jogos"><img src="/jka-games-logo.png?v=g2" alt="JKA games" width="102" height="68" /></a>;
}

function GamesHome() {
  const saved = getStored(SESSION_KEY);
  const resumeCode = typeof saved?.code === 'string' && /^[A-Z0-9]{6}$/.test(saved.code) ? saved.code : null;
  return <main>
    <header className="site-header"><div className="brand-row"><BrandLogo /><span className="tagline">Jogos para juntar os amigos.</span></div></header>
    <section className="games-home" aria-labelledby="games-title">
      <h1 id="games-title">Escolhe o teu jogo</h1>
      <p className="muted">Uma marca, vários jogos. Junta os amigos e começa uma partida.</p>
      <article className="panel game-card" aria-labelledby="quiz-title">
        <span className="eyebrow">Perguntas e adivinhas · 1 a 20 jogadores</span>
        <h2 id="quiz-title">{QUIZ_NAME}</h2>
        <p>Reconhece jogadores, descobre personagens e responde sobre os teus temas favoritos. Quem acerta mais depressa ganha mais pontos.</p>
        <p className="muted small">Salas privadas · perguntas personalizadas · fotografias</p>
        <div className="row wrap"><a className="button-link primary" href={QUIZ_PATH}>Jogar {QUIZ_NAME}</a>
          {resumeCode && <a className="button-link" href={`${QUIZ_PATH}?sala=${resumeCode}`}>Retomar sala {resumeCode}</a>}</div>
      </article>
    </section>
    <footer>JKA games · jogos para amigos</footer>
  </main>;
}

function request(event, data = {}) {
  return new Promise((resolve, reject) => {
    if (!socket.connected) { reject(new Error('Sem ligação. A aguardar reconexão…')); return; }
    // Timed answers must never queue across a disconnect. Control requests must
    // survive the transport's short busy period immediately after connecting.
    const channel = event === 'answer:submit' ? socket.volatile : socket;
    channel.timeout(event === 'config:save' ? 20000 : 5000).emit(event, data, (error, result) => {
      if (error) reject(new Error('Sem confirmação do servidor. Verifica o estado da sala antes de repetir.'));
      else if (!result?.ok) reject(new Error(result?.error ?? 'Não foi possível concluir.'));
      else resolve(result);
    });
  });
}

async function prepareImage(file) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Escolhe uma imagem PNG, JPEG ou WebP.');
  if (file.size > 10 * 1024 * 1024) throw new Error('A imagem original deve ter no máximo 10 MB.');
  const url = URL.createObjectURL(file);
  try {
    const source = new Image();
    await new Promise((resolve, reject) => { source.onload = resolve; source.onerror = () => reject(new Error('Não foi possível abrir esta imagem.')); source.src = url; });
    const scale = Math.min(1, 1280 / source.naturalWidth, 900 / source.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Este browser não permite preparar a imagem.');
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    for (const quality of [.85, .65, .45]) {
      const data = canvas.toDataURL('image/webp', quality);
      if (data.length <= 409600) return data;
    }
    throw new Error('A imagem é demasiado pesada. Escolhe uma imagem mais pequena.');
  } finally { URL.revokeObjectURL(url); }
}

function Rules({ fuzzy }) {
  return <details className="rules"><summary>Como se joga · pontos e tempos</summary>
    <p>A partida começa após uma contagem de 3 segundos. As perguntas são sempre aleatórias. Depois de cada ronda, tens 3 segundos para veres a resposta e os pontos antes da próxima pergunta.</p>
    <p><strong>Ganha o primeiro jogador a atingir ou ultrapassar o objetivo de pontos escolhido pelo host.</strong> Nesse instante, a ronda termina e o ranking final aparece após os 3 segundos de resposta. Se as perguntas acabarem antes, são novamente baralhadas e o jogo continua. Quando há várias perguntas, a última de um ciclo não se repete logo no início do seguinte.</p>
    <p><strong>Cada acerto vale entre 1 e 10 pontos.</strong> Quanto mais depressa acertares, mais pontos ganhas: 10 no primeiro décimo do tempo, 9 no seguinte, até 1 no último. Fórmula: máximo de 1 e arredondamento para cima de 10 × (1 − tempo de resposta / duração). Erros ou falta de resposta: 0 pontos. Exemplo: 5 s numa pergunta de 20 s = 8 pontos.</p>
    <p>O tempo começa no instante de início definido pelo servidor e termina quando o servidor recebe a resposta correta. Inclui o tempo de leitura, escrita e envio pela rede; não desconta a latência. É medido com relógio monotónico e apresentado ao milissegundo. O contador no ecrã é uma aproximação sincronizada.</p>
    <p>Maiúsculas, acentos, pontuação e espaços repetidos são normalizados. As alternativas indicadas pelo host são aceites.
      {fuzzy === false ? ' A tolerância a gralhas está desligada.' : ' Com tolerância ligada: respostas com 5–9 caracteres aceitam 1 edição; com 10 ou mais, 2 edições (inserir, apagar, substituir ou trocar letras adjacentes). Respostas até 4 caracteres e números exigem correspondência exata após normalização.'}</p>
    <p>Não podes repetir a mesma tentativa normalizada. Intervalo mínimo: 0,3 s; máximo: 50 tentativas por ronda. A ronda termina quando todos os participantes acertam ou o tempo acaba. O ranking final aparece automaticamente.</p>
    <p>Classificação: pontos, depois número de acertos, depois soma dos tempos dos acertos (menor vence); empate restante ordenado por nickname. O host conhece as respostas. Quem entrar a meio assiste e joga na próxima partida.</p>
    <p>Uma quebra de ligação mantém os pontos. Volta no mesmo separador para recuperar a sessão. Se o host ficar desligado por 30 s, passa a função a um jogador ligado. Reiniciar o servidor apaga as salas.</p>
  </details>;
}

function Editor({ room, busy, connected, action, onDirty }) {
  const [draft, setDraft] = useState(() => structuredClone(room.config));
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [themeFilter, setThemeFilter] = useState('');
  const [page, setPage] = useState(0);
  const fileRef = useRef();
  const themes = [...new Set(draft.questions.map(q => q.theme || 'Geral'))].sort((a, b) => a.localeCompare(b, 'pt'));
  const filteredQuestions = draft.questions.map((q, index) => ({ q, index })).filter(({ q }) => !themeFilter || (q.theme || 'Geral') === themeFilter);
  const pageCount = Math.max(1, Math.ceil(filteredQuestions.length / 10));
  const visibleQuestions = filteredQuestions.slice(page * 10, page * 10 + 10);
  useEffect(() => {
    setDraft(structuredClone(room.config)); setDirty(false); onDirty(false);
  }, [room.code, room.revision]);
  useEffect(() => { setPage(current => Math.min(current, pageCount - 1)); }, [pageCount]);
  useEffect(() => {
    const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function change(next) { setDraft(next); setDirty(true); onDirty(true); setMessage(''); }
  function question(index, field, value) {
    change({ ...draft, questions: draft.questions.map((q, i) => i === index ? { ...q, [field]: value } : q) });
  }
  async function save() {
    const result = await action('config:save', { revision: room.revision, config: draft });
    if (result) setMessage('Perguntas guardadas na sala. Exporta uma cópia para manteres depois de o servidor reiniciar.');
  }
  async function addImage(event, index) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setImageBusy(true); onDirty(true); setMessage('A preparar imagem…');
    try {
      const image = await prepareImage(file);
      setDraft(current => ({ ...current, questions: current.questions.map((q, i) => i === index ? { ...q, image } : q) }));
      setDirty(true); onDirty(true); setMessage('Imagem pronta. Guarda as perguntas para aplicar.');
    } catch (error) { setMessage(error.message); onDirty(dirty); }
    finally { setImageBusy(false); }
  }
  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 3 * 1024 * 1024) throw new Error('O ficheiro deve ter no máximo 3 MB, incluindo a formatação do JSON.');
      const value = JSON.parse(await file.text());
      if (!Array.isArray(value.questions) || !value.questions.length || value.questions.length > 500 ||
        !Number.isInteger(value.durationSeconds) || value.durationSeconds < 5 || value.durationSeconds > 120 ||
        typeof value.fuzzy !== 'boolean' ||
        (value.targetPoints !== undefined && (!Number.isInteger(value.targetPoints) || value.targetPoints < 1 || value.targetPoints > 1000)) ||
        value.questions.some(q => !q || typeof q.theme !== 'string' || q.theme.length > 60 ||
          typeof q.prompt !== 'string' || !q.prompt.trim() || q.prompt.length > 500 ||
          (q.image !== undefined && (typeof q.image !== 'string' || q.image.length > 409664 || !/^data:image\/(png|jpeg|webp);base64,/.test(q.image))) ||
          !Array.isArray(q.answers) || !q.answers.length || q.answers.length > 10 ||
          q.answers.some(a => typeof a !== 'string' || !a.trim() || a.length > 120))) {
        throw new Error('Formato inválido. Usa um ficheiro exportado pelo jogo ou o exemplo do projeto.');
      }
      change({ ...value, targetPoints: value.targetPoints ?? 50, shuffle: true }); setThemeFilter(''); setPage(0); setMessage('Ficheiro importado. Carrega em Guardar perguntas para aplicar.');
    } catch (error) { setMessage(error.message); }
  }
  function exportFile() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'trigo-perguntas.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="panel">
    <div className="section-heading"><h2>Perguntas da sala</h2><span className="muted">{draft.questions.length}/500</span></div>
    <p className="muted">Só o host pode editar. As alterações aplicam-se à próxima partida.</p>
    <div className="settings">
      <label>Segundos por pergunta<input type="number" min="5" max="120" step="1" value={draft.durationSeconds} onChange={e => change({ ...draft, durationSeconds: Number(e.target.value) })} /></label>
      <label>Pontos para ganhar<input type="number" min="1" max="1000" step="1" value={draft.targetPoints} onChange={e => change({ ...draft, targetPoints: Number(e.target.value) })} /></label>
      <label className="check"><input type="checkbox" checked={draft.fuzzy} onChange={e => change({ ...draft, fuzzy: e.target.checked })} /> Aceitar pequenos erros de escrita</label>
      <span className="muted small">Perguntas sempre aleatórias · resposta visível durante 3 s</span>
    </div>
    <div className="editor-navigation">
      <label>Mostrar tema no editor<select value={themeFilter} onChange={e => { setThemeFilter(e.target.value); setPage(0); }}><option value="">Todos os temas ({draft.questions.length})</option>{themes.map(theme => <option key={theme} value={theme}>{theme} ({draft.questions.filter(q => (q.theme || 'Geral') === theme).length})</option>)}</select></label>
      <div className="row"><button disabled={page === 0 || imageBusy} onClick={() => setPage(p => p - 1)}>Anterior</button><span className="muted small">Página {page + 1}/{pageCount}</span><button disabled={page + 1 >= pageCount || imageBusy} onClick={() => setPage(p => p + 1)}>Seguinte</button></div>
    </div>
    <p className="muted small">Este filtro só organiza a edição. Todas as perguntas guardadas entram no jogo.</p>
    <div className="questions-editor">{visibleQuestions.map(({ q, index }) => <fieldset key={index} disabled={imageBusy}>
      <legend>Pergunta {index + 1}</legend>
      <label>Tema<input maxLength="60" value={q.theme} onChange={e => question(index, 'theme', e.target.value)} /></label>
      <label>Pergunta<textarea rows="2" maxLength="500" value={q.prompt} onChange={e => question(index, 'prompt', e.target.value)} /></label>
      <label>Imagem opcional · PNG, JPEG ou WebP<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => addImage(e, index)} /></label>
      {q.image && <div className="image-preview"><img src={q.image} alt={`Imagem da pergunta ${index + 1}`} /><button className="quiet danger" onClick={() => question(index, 'image', undefined)}>Remover imagem</button></div>}
      <label>Respostas aceites · separa alternativas com |<input value={q.answers.join('|')} onChange={e => question(index, 'answers', e.target.value.split('|'))} placeholder="Lisboa | Lisbon" /></label>
      <div className="row end"><button className="quiet danger" onClick={() => change({ ...draft, questions: draft.questions.filter((_, i) => i !== index) })} disabled={draft.questions.length <= 1}>Remover pergunta {index + 1}</button></div>
    </fieldset>)}</div>
    <div className="row wrap">
      <button onClick={() => { change({ ...draft, questions: [...draft.questions, { theme: 'Geral', prompt: '', answers: [''] }] }); setThemeFilter(''); setPage(Math.floor(draft.questions.length / 10)); }} disabled={imageBusy || draft.questions.length >= 500}>+ Pergunta</button>
      <button disabled={imageBusy} onClick={() => fileRef.current.click()}>Importar JSON</button><button onClick={exportFile}>Exportar JSON</button>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={importFile} />
      <button className="primary" disabled={busy || imageBusy || !connected || !dirty} onClick={save}>Guardar perguntas</button>
    </div>
    <p className={dirty ? 'notice' : 'muted'} role="status">{dirty ? 'Tens alterações por guardar. Guarda antes de iniciar.' : 'Perguntas guardadas na sala.'}</p>
    {message && <p role="status">{message}</p>}
  </section>;
}

function Ranking({ room }) {
  const reveal = ['results', 'finished'].includes(room.phase);
  return <aside className="panel ranking"><h2>{room.phase === 'lobby' ? 'Jogadores' : 'Classificação'}</h2>
    <p className="muted">{room.players.filter(p => p.connected).length} ligados · máximo 20<br /><strong>Objetivo: {room.targetPoints} pontos</strong></p>
    <ol className="player-list">{room.players.map(p => <li key={p.id}>
      <div className="player-main"><div><strong>{p.name}</strong>{p.id === room.meId && <small> tu</small>}
        <div className="muted player-status">{p.id === room.hostId ? 'Host · ' : ''}{p.left ? 'Saiu' : !p.connected ? 'Desligado' : room.phase === 'lobby' ? 'No lobby' : !p.participating ? 'Espectador' : p.solved ? 'Acertou' : reveal ? 'Sem acerto' : 'A responder'}</div>
      </div><strong className="points">{p.score}<small> pts</small></strong></div>
      {reveal && p.participating && <div className="round-stats">Ronda: +{p.roundPoints} · {p.responseMs === null ? '—' : secs(p.responseMs)}</div>}
      {room.phase === 'finished' && <div className="round-stats">{p.correct} acertos · média {p.averageMs === null ? '—' : secs(p.averageMs)}</div>}
    </li>)}</ol>
  </aside>;
}

function QuestionImage({ url }) {
  const [state, setState] = useState('loading');
  return <div className="question-image">
    {state === 'loading' && <p className="muted" role="status">A carregar imagem…</p>}
    {state === 'error' && <p className="error" role="alert">Não foi possível carregar a imagem. Verifica a ligação.</p>}
    <img src={url} alt="Imagem para adivinhar" onLoad={() => setState('ready')} onError={() => setState('error')} />
  </div>;
}

function Question({ room, connected, busy, action, offset }) {
  const [now, setNow] = useState(Date.now());
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const inputRef = useRef();
  const roundIdRef = useRef(room.round.id);
  const round = room.round;
  const serverNow = now + offset;
  const countdown = Math.max(0, Math.ceil((round.startsAt - serverNow) / 1000));
  const remaining = Math.max(0, (round.deadline - serverNow) / 1000);
  const me = room.players.find(p => p.id === room.meId);
  const active = room.phase === 'question' && !countdown && remaining > 0;
  const disabled = !active || !connected || busy || !!round.mine || !me?.participating;
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 50); return () => clearInterval(interval); }, []);
  useEffect(() => { roundIdRef.current = round.id; setAnswer(''); setFeedback(null); }, [round.id]);
  useEffect(() => { if (!disabled) inputRef.current?.focus(); }, [disabled, round.id]);
  async function submit(event) {
    event.preventDefault(); if (disabled || !answer.trim()) return;
    const id = round.id;
    const result = await action('answer:submit', { answer, roundId: id, requestId: makeId() });
    if (roundIdRef.current !== id) return;
    if (result) {
      setFeedback(result.correct ? { type: 'success', text: `Correto! +${result.points} pontos · ${secs(result.elapsedMs)}` } : { type: 'error', text: 'Ainda não. Tenta outra resposta.' });
      setAnswer('');
    }
  }
  const reveal = ['results', 'finished'].includes(room.phase);
  return <section className="panel question-panel">
    <div className="section-heading"><span className="eyebrow">Pergunta {round.number} · {round.theme}<br />Objetivo: {room.targetPoints} pontos</span>
      <strong className="timer" aria-label="Tempo restante">{reveal ? 'Terminou' : countdown ? `Começa em ${countdown}` : `${remaining.toFixed(1)} s`}</strong></div>
    <progress max={round.durationMs} value={reveal ? 0 : countdown ? round.durationMs : remaining * 1000} aria-label="Tempo da ronda" />
    <h2 className="prompt">{countdown && !reveal ? 'Prepara-te…' : round.prompt ?? 'A receber pergunta…'}</h2>
    {round.imageUrl && <QuestionImage key={round.imageUrl} url={round.imageUrl} />}
    {!reveal && <form onSubmit={submit} className="answer-form">
      <label htmlFor="answer">A tua resposta</label>
      <div className="row"><input ref={inputRef} id="answer" autoComplete="off" autoCapitalize="off" spellCheck="false" maxLength="120" value={answer} onChange={e => setAnswer(e.target.value)} disabled={disabled} placeholder={me?.participating ? 'Escreve e carrega Enter' : 'Jogas na próxima partida'} /><button className="primary" disabled={disabled || !answer.trim()}>Enviar</button></div>
    </form>}
    <div className="feedback" role="status" aria-live="polite">
      {round.mine ? <p className="success">Correto! +{round.mine.points} pontos · {secs(round.mine.elapsedMs)}</p> : feedback ? <p className={feedback.type}>{feedback.text}</p> : !me?.participating ? <p className="notice">Estás a assistir. Participas na próxima partida.</p> : null}
    </div>
    {reveal && <div className="revealed"><span className="muted">Resposta{round.answers.length > 1 ? 's aceites' : ''}</span><p><strong>{round.answers.join(' / ')}</strong></p></div>}
    {reveal && round.imageCredit && <p className="muted small">Fotografia: {round.imageCredit}{round.imageSource && <> · <a href={round.imageSource} target="_blank" rel="noreferrer">Fonte</a></>}{round.imageLicense && <> · <a href={round.imageLicense} target="_blank" rel="noreferrer">Licença</a></>}</p>}
    {room.phase === 'results' && <p className="muted" role="status">{room.winnerId ? 'Ranking final' : 'Próxima pergunta'} em {Math.min(3, Math.max(0, Math.ceil((room.advanceAt - serverNow) / 1000)))} s…</p>}
  </section>;
}

function App() {
  useEffect(() => { document.title = `${QUIZ_NAME} | JKA games`; }, []);
  const [connected, setConnected] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [room, setRoom] = useState(null);
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState(() => shortCode(new URLSearchParams(location.search).get('sala') ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [offset, setOffset] = useState(0);
  const [dirty, setDirty] = useState(false);
  const pendingRef = useRef(false);
  const isHost = room?.hostId === room?.meId;
  useEffect(() => {
    let mounted = true;
    const state = value => {
      if (!mounted) return;
      setRoom(value); setCode(value.code);
      // Fallback before the first round-trip clock sample arrives.
      setOffset(previous => previous || value.serverNow - Date.now());
    };
    const synchronize = async () => {
      const start = Date.now();
      try { const result = await request('clock:sync'); if (mounted) setOffset(result.serverNow - (start + Date.now()) / 2); } catch { /* Next periodic sync retries. */ }
    };
    const connect = async () => {
      setConnected(true); setError('');
      const saved = getStored(SESSION_KEY);
      if (saved) {
        setRestoring(true);
        try { const result = await request('room:resume', saved); state(result.state); }
        catch (err) {
          // A timeout is recoverable; retain credentials and offer a retry.
          if (socket.connected && /sessão|expirou/i.test(err.message)) { setStored(SESSION_KEY, null); setRoom(null); }
          if (mounted) setError(err.message);
        }
      }
      if (mounted) setRestoring(false);
      synchronize();
    };
    const disconnect = () => { if (mounted) { setConnected(false); setRestoring(false); } };
    const connectionError = () => { if (mounted) { setConnected(false); setRestoring(false); setError('Não foi possível ligar ao servidor. A tentar novamente…'); } };
    const replaced = () => { setStored(SESSION_KEY, null); setRoom(null); setError('Esta sessão foi aberta noutro separador. Usa esse separador ou entra com outro nickname.'); };
    const expired = () => { setStored(SESSION_KEY, null); setRoom(null); setError('A sala expirou. Cria uma nova sala.'); };
    socket.on('connect', connect); socket.on('disconnect', disconnect); socket.on('connect_error', connectionError);
    socket.on('room:state', state); socket.on('session:replaced', replaced); socket.on('room:expired', expired);
    socket.connect();
    const interval = setInterval(() => { if (socket.connected) synchronize(); }, 20000);
    return () => {
      mounted = false; clearInterval(interval);
      socket.off('connect', connect); socket.off('disconnect', disconnect); socket.off('connect_error', connectionError);
      socket.off('room:state', state); socket.off('session:replaced', replaced); socket.off('room:expired', expired); socket.disconnect();
    };
  }, []);

  async function action(event, data) {
    if (pendingRef.current) return null;
    pendingRef.current = true; setBusy(true); setError(''); setNotice('');
    try { return await request(event, data); }
    catch (err) { setError(err.message); return null; }
    finally { pendingRef.current = false; setBusy(false); }
  }
  async function enter(mode) {
    const result = await action(mode === 'create' ? 'room:create' : 'room:join', { nickname, code });
    if (result) {
      setStored(SESSION_KEY, { code: result.code, token: result.token });
      setRoom(result.state); setDirty(false);
      history.replaceState(null, '', `?sala=${result.code}`);
    }
  }
  async function leave() {
    const result = await action('room:leave');
    if (result) { setStored(SESSION_KEY, null); setRoom(null); setDirty(false); history.replaceState(null, '', location.pathname); }
  }
  async function copyLink() {
    const url = `${location.origin}${location.pathname}?sala=${room.code}`;
    try { await navigator.clipboard.writeText(url); setNotice('Link copiado. Envia-o aos teus amigos.'); }
    catch { setNotice(`Link da sala: ${url}`); }
  }
  const disabled = !connected || busy || restoring;
  return <main>
    <header className="site-header"><div className="brand-row"><BrandLogo /><div className="game-identity"><strong>{QUIZ_NAME}</strong><span>Um jogo JKA games</span></div></div>
      <span className={`connection ${connected ? 'online' : ''}`} role="status">{restoring ? 'A recuperar sessão…' : connected ? 'Ligado' : 'A ligar…'}</span></header>
    {error && <div className="banner error" role="alert">{error}</div>}
    {notice && <div className="banner" role="status">{notice}</div>}
    {room && !connected && <div className="banner notice">A ligação caiu. A reconexão é automática; os pontos mantêm-se e o tempo da ronda continua.</div>}
    {!room ? <div className="home">
      <section className="panel"><span className="eyebrow">Perguntas e adivinhas</span><h1>{QUIZ_NAME}</h1>
        <p>Junta os amigos. Quem sabe mais depressa?</p>
        <p className="muted">Salas privadas para 1 a 20 pessoas. Testa sozinho ou convida os amigos para jogar no computador ou no telemóvel.</p>
        <label htmlFor="nickname">O teu nickname<input id="nickname" maxLength="24" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Como te chamas no jogo?" autoComplete="nickname" /></label>
        <button className="primary full" disabled={disabled || !nickname.trim()} onClick={() => enter('create')}>Criar sala privada</button>
        <div className="divider">ou entra numa sala</div>
        <form onSubmit={e => { e.preventDefault(); enter('join'); }}><label htmlFor="code">Código da sala<input id="code" className="code-input" value={code} onChange={e => setCode(shortCode(e.target.value))} placeholder="ABC234" maxLength="6" autoCapitalize="characters" autoComplete="off" /></label>
          <button className="full" disabled={disabled || !nickname.trim() || code.length !== 6}>Entrar na sala</button></form>
        {!connected && <button className="quiet full" onClick={() => socket.connect()}>Voltar a ligar</button>}
        {getStored(SESSION_KEY) && connected && <button className="quiet full" onClick={() => { socket.disconnect(); socket.connect(); }}>Recuperar sessão anterior</button>}
      </section><Rules />
    </div> : <>
      <section className="room-heading"><div><span className="eyebrow">Sala privada</span><h1 className="room-code">{room.code}</h1></div>
        <div className="row wrap"><button onClick={copyLink}>Copiar convite</button><button className="quiet" disabled={disabled} onClick={leave}>Sair da sala</button></div></section>
      <div className="game-layout"><div className="game-main">
        {room.phase === 'lobby' && <section className="panel"><h2>{isHost ? 'A tua sala está pronta' : 'À espera do host'}</h2>
          <p>{isHost ? 'Partilha o convite e edita as perguntas abaixo. Quando todos estiverem aqui, inicia a partida.' : 'O host está a preparar as perguntas. A partida começa para todos ao mesmo tempo.'}</p>
          <p className="muted">{room.questionCount} perguntas aleatórias · {room.settings.durationSeconds} s por pergunta · ganha aos {room.settings.targetPoints} pontos · {room.settings.fuzzy ? 'com' : 'sem'} tolerância a gralhas</p>
          {isHost && <><button className="primary" disabled={disabled || dirty || room.players.filter(p => p.connected).length < 1} onClick={() => action('game:start')}>Iniciar partida</button><p className="muted small">Podes testar sozinho ou jogar com amigos, até 20 pessoas.</p></>}
        </section>}
        {room.round && <Question room={room} connected={connected} busy={busy} action={action} offset={offset} />}
        {room.phase === 'finished' && <section className="panel"><span className="eyebrow">Ranking final</span><h2>{room.winnerId ? `${room.players.find(p => p.id === room.winnerId)?.name} venceu!` : 'Partida terminada'}</h2>
          <p>Objetivo de {room.targetPoints} pontos atingido. Confere a pontuação, os acertos e os tempos na classificação.</p>
          {isHost ? <><button className="primary" disabled={disabled || dirty || room.players.filter(p => p.connected).length < 1} onClick={() => action('game:start')}>Jogar novamente</button><p className="muted small">A nova partida começa do zero. Podes editar as perguntas antes.</p></> : <p className="muted">O host pode iniciar outra partida.</p>}
        </section>}
        {isHost && room.config && <Editor key={`${room.code}-${room.meId}`} room={room} busy={busy} connected={connected} action={action} onDirty={setDirty} />}
        <Rules fuzzy={room.settings.fuzzy} />
      </div><Ranking room={room} /></div>
    </>}
    <footer>{QUIZ_NAME} · um jogo JKA games · <a href="/">Todos os jogos</a></footer>
  </main>;
}

// Older invitations used /?sala=CODE. Keep them opening the quiz directly.
const quizRoute = location.pathname.replace(/\/+$/, '') === QUIZ_PATH || new URLSearchParams(location.search).has('sala');
createRoot(document.getElementById('root')).render(quizRoute ? <App /> : <GamesHome />);
