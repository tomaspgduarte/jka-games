import React, { useContext, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import { LangContext, loadLang, saveLang, useMessage, useT } from './i18n.js';
import { playCorrect, playOtherCorrect, setSoundEnabled, soundEnabled, unlockAudio } from './sounds.js';
import '@fontsource/baloo-2/500.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
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
  const t = useT();
  return <a className="brand" href="/" aria-label={t('JKA games — todos os jogos')}><img src="/jka-games-logo.png?v=g2" alt="JKA games" width="102" height="68" /></a>;
}

// The ten stars of the Cabo Verde flag, as decoration.
const Stars = () => <span className="stars" aria-hidden="true">★★★★★★★★★★</span>;

function LanguageToggle() {
  const { lang, setLang } = useContext(LangContext);
  // Each label is written in the language it switches to.
  return lang === 'en'
    ? <button className="lang-toggle" lang="pt-PT" aria-label="Mudar para português" onClick={() => setLang('pt')}>Português</button>
    : <button className="lang-toggle" lang="en" aria-label="Switch to English" onClick={() => setLang('en')}>English</button>;
}

function SoundToggle() {
  const t = useT();
  const [on, setOn] = useState(soundEnabled);
  const toggle = () => { setSoundEnabled(!on); setOn(!on); if (!on) { unlockAudio(); playOtherCorrect(); } };
  const label = t(on ? 'Desligar som' : 'Ligar som');
  return <button className="lang-toggle sound-toggle" aria-label={label} title={label} aria-pressed={on} onClick={toggle}>{on ? '🔊' : '🔇'}</button>;
}

function GamesHome() {
  const t = useT();
  const saved = getStored(SESSION_KEY);
  const resumeCode = typeof saved?.code === 'string' && /^[A-Z0-9]{6}$/.test(saved.code) ? saved.code : null;
  return <main>
    <header className="site-header"><div className="brand-row"><BrandLogo /><span className="tagline">{t('Jogos para juntar os amigos.')}<Stars /></span></div><LanguageToggle /></header>
    <section className="games-home" aria-labelledby="games-title">
      <h1 id="games-title">{t('Escolhe o teu jogo')}</h1>
      <p className="muted">{t('Uma marca, vários jogos. Junta os amigos e começa uma partida.')}</p>
      <article className="panel game-card" aria-labelledby="quiz-title">
        <span className="eyebrow">{t('Perguntas e adivinhas · 1 a 20 jogadores')}</span>
        <h2 id="quiz-title">{QUIZ_NAME}</h2>
        <p>{t('Reconhece jogadores, descobre personagens e responde sobre os teus temas favoritos. Quem acerta mais depressa ganha mais pontos.')}</p>
        <p className="muted small">{t('Salas privadas · perguntas personalizadas · fotografias')}</p>
        <div className="row wrap"><a className="button-link primary" href={QUIZ_PATH}>{t('Jogar {name}', { name: QUIZ_NAME })}</a>
          {resumeCode && <a className="button-link" href={`${QUIZ_PATH}?sala=${resumeCode}`}>{t('Retomar sala {code}', { code: resumeCode })}</a>}</div>
      </article>
    </section>
    <footer>{t('JKA games · jogos para amigos')}</footer>
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

function Rules({ fuzzy }) {
  const t = useT();
  return <details className="rules"><summary>{t('Como se joga · pontos e tempos')}</summary>
    <p>{t('A partida começa após uma contagem de 3 segundos. As perguntas são sempre aleatórias. Depois de cada ronda, tens 3 segundos para veres a resposta e os pontos antes da próxima pergunta.')}</p>
    <p><strong>{t('Ganha o primeiro jogador a atingir ou ultrapassar o objetivo de pontos escolhido pelo host.')}</strong> {t('Nesse instante, a ronda termina e o ranking final aparece após os 3 segundos de resposta. Se as perguntas acabarem antes, são novamente baralhadas e o jogo continua. Quando há várias perguntas, a última de um ciclo não se repete logo no início do seguinte.')}</p>
    <p><strong>{t('Cada acerto vale entre 1 e 10 pontos.')}</strong> {t('O primeiro a acertar ganha 10 pontos, e quem acertar até 1 segundo depois dele também. A seguir, os pontos descem com o tempo (10 no primeiro décimo, 9 no seguinte, até 1 no último) e cada jogador que já acertou tira mais 1 ponto. Erros ou falta de resposta: 0 pontos. Exemplo numa pergunta de 20 s: o 1.º acerta aos 5 s (10 pontos), o 2.º aos 5,5 s (10 pontos) e o 3.º aos 8 s fica com 6 − 2 = 4 pontos.')}</p>
    <p>{t('O tempo começa no instante de início definido pelo servidor e termina quando o servidor recebe a resposta correta. Inclui o tempo de leitura, escrita e envio pela rede; não desconta a latência. É medido com relógio monotónico e apresentado ao milissegundo. O contador no ecrã é uma aproximação sincronizada.')}</p>
    <p>{t('Maiúsculas, acentos, pontuação e espaços repetidos são normalizados. As alternativas indicadas pelo host são aceites.')}{' '}
      {t(fuzzy === false ? 'A tolerância a erros de escrita está desligada.' : 'Com tolerância ligada: respostas com 5–9 caracteres aceitam 1 edição; com 10 ou mais, 2 edições (inserir, apagar, substituir ou trocar letras adjacentes). Respostas até 4 caracteres e números exigem correspondência exata após normalização.')}</p>
    <p>{t('Não podes repetir a mesma tentativa normalizada. Intervalo mínimo: 0,3 s; máximo: 50 tentativas por ronda. A ronda termina quando todos os participantes acertam ou o tempo acaba. O ranking final aparece automaticamente.')}</p>
    <p>{t('Classificação: pontos, depois número de acertos, depois soma dos tempos dos acertos (menor vence); empate restante ordenado por nickname. Ninguém recebe as respostas antes do tempo, nem o host. Quem entrar a meio assiste e joga na próxima partida.')}</p>
    <p>{t('Uma quebra de ligação mantém os pontos. Volta no mesmo separador para recuperar a sessão. Se o host ficar desligado por 30 s, passa a função a um jogador ligado. Se o host sair da sala, a sala fecha para todos. Reiniciar o servidor apaga as salas.')}</p>
  </details>;
}

function Editor({ room, busy, connected, action, onDirty, saveRef }) {
  const t = useT();
  const show = useMessage();
  const fromRoom = () => ({ durationSeconds: room.settings.durationSeconds, targetPoints: room.settings.targetPoints, fuzzy: room.settings.fuzzy, themes: room.settings.themes });
  const [draft, setDraft] = useState(fromRoom);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    setDraft(fromRoom()); setDirty(false); onDirty(false);
  }, [room.code, room.revision]);
  const names = room.categories.map(c => c.name);
  const chosen = new Set(draft.themes);
  const allChosen = chosen.size === names.length;
  const total = room.categories.reduce((sum, c) => sum + (chosen.has(c.name) ? c.count : 0), 0);
  function change(next) { setDraft(next); setDirty(true); onDirty(true); setMessage(''); }
  // Keep the bank's order so the saved list is stable.
  const toggle = name => change({ ...draft, themes: names.filter(n => n === name ? !chosen.has(n) : chosen.has(n)) });
  async function save() {
    if (!draft.themes.length) { setMessage('Escolhe pelo menos uma categoria.'); return null; }
    const result = await action('config:save', { revision: room.revision, config: draft });
    if (result) setMessage('Opções guardadas.');
    return result;
  }
  // Lets the start button save pending changes first.
  saveRef.current = save;
  return <section className="panel">
    <div className="section-heading"><h2>{t('Opções da partida')}</h2><span className="muted">{t('{count} perguntas', { count: total })}</span></div>
    <p className="muted">{t('Só o host pode mudar. As alterações aplicam-se à próxima partida.')}</p>
    <div className="settings">
      <label>{t('Segundos por pergunta')}<input type="number" min="5" max="120" step="1" value={draft.durationSeconds} onChange={e => change({ ...draft, durationSeconds: Number(e.target.value) })} /></label>
      <label>{t('Pontos para ganhar')}<input type="number" min="1" max="1000" step="1" value={draft.targetPoints} onChange={e => change({ ...draft, targetPoints: Number(e.target.value) })} /></label>
      <label className="check"><input type="checkbox" checked={draft.fuzzy} onChange={e => change({ ...draft, fuzzy: e.target.checked })} /> {t('Aceitar pequenos erros de escrita')}</label>
    </div>
    <h3 id="categories-title">{t('Categorias')}</h3>
    <p className="muted small">{t('Toca numa categoria para a tirar ou voltar a pôr.')}</p>
    <div className="categories" role="group" aria-labelledby="categories-title">
      <button type="button" className={allChosen ? 'category all on' : 'category all'} aria-pressed={allChosen} onClick={() => change({ ...draft, themes: allChosen ? [] : names })}>{t('Todas')}</button>
      {room.categories.map(c => <button type="button" key={c.name} className={chosen.has(c.name) ? 'category on' : 'category'} aria-pressed={chosen.has(c.name)} onClick={() => toggle(c.name)}>
        {chosen.has(c.name) && <span aria-hidden="true">✓ </span>}{c.name} <small>{c.count}</small></button>)}
    </div>
    {!draft.themes.length && <p className="error" role="alert">{t('Escolhe pelo menos uma categoria.')}</p>}
    <div className="row wrap"><button className="primary" disabled={busy || !connected || !dirty || !draft.themes.length} onClick={save}>{t('Guardar opções')}</button></div>
    <p className={dirty ? 'notice' : 'muted'} role="status">{t(dirty ? 'Tens alterações por guardar. São guardadas ao iniciar a partida.' : 'Opções guardadas na sala.')}</p>
    {message && <p role="status">{show(message)}</p>}
  </section>;
}

function Ranking({ room, isHost, disabled, action }) {
  const t = useT();
  const reveal = ['results', 'finished'].includes(room.phase);
  async function kick(player) {
    if (confirm(t('Expulsar {name} da sala?', { name: player.name }))) await action('player:kick', { playerId: player.id });
  }
  return <aside className="panel ranking"><h2>{t(room.phase === 'lobby' ? 'Jogadores' : 'Classificação')}</h2>
    <p className="muted">{t('{count} ligados · máximo 20', { count: room.players.filter(p => p.connected).length })}<br /><strong>{t('Objetivo: {points} pontos', { points: room.targetPoints })}</strong></p>
    <ol className={room.phase === 'lobby' ? 'player-list' : 'player-list scored'}>{room.players.map(p => <li key={p.id} className={p.solved && ['question', 'results'].includes(room.phase) ? 'solved' : undefined}>
      <div className="player-main"><div><strong className="player-name">{p.solved && ['question', 'results'].includes(room.phase) && <span aria-hidden="true">✓ </span>}{p.name}</strong>{p.id === room.meId && <small> {t('tu')}</small>}
        <div className="muted player-status">{p.id === room.hostId ? `${t('Host')} · ` : ''}{t(p.kicked ? 'Expulso' : p.left ? 'Saiu' : !p.connected ? 'Desligado' : room.phase === 'lobby' ? 'No lobby' : !p.participating ? 'Espectador' : p.solved ? 'Acertou' : reveal ? 'Sem acerto' : 'A responder')}</div>
        {isHost && p.id !== room.meId && !p.left && <button className="quiet danger kick" disabled={disabled} onClick={() => kick(p)} aria-label={t('Expulsar {name}', { name: p.name })}>{t('Expulsar')}</button>}
      </div><strong className="points">{p.score}<small> pts</small></strong></div>
      {reveal && p.participating && <div className="round-stats">{t('Ronda: +{points} · {time}', { points: p.roundPoints, time: p.responseMs === null ? '—' : secs(p.responseMs) })}</div>}
      {room.phase === 'finished' && <div className="round-stats">{t('{count} acertos · média {time}', { count: p.correct, time: p.averageMs === null ? '—' : secs(p.averageMs) })}</div>}
    </li>)}</ol>
  </aside>;
}

function QuestionImage({ url }) {
  const t = useT();
  const [state, setState] = useState('loading');
  return <div className="question-image">
    {state === 'loading' && <p className="muted" role="status">{t('A carregar imagem…')}</p>}
    {state === 'error' && <p className="error" role="alert">{t('Não foi possível carregar a imagem. Verifica a ligação.')}</p>}
    <img src={url} alt={t('Imagem para adivinhar')} onLoad={() => setState('ready')} onError={() => setState('error')} />
  </div>;
}

function Question({ room, connected, busy, action, offset }) {
  const t = useT();
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
  // Play a pop when someone else newly solves this round; players already solved on load stay silent.
  const solvedIds = room.players.filter(p => p.solved).map(p => p.id);
  const heardRef = useRef({ round: null, ids: new Set() });
  useEffect(() => {
    const heard = heardRef.current;
    if (heard.round !== round.id) { heardRef.current = { round: round.id, ids: new Set(solvedIds) }; return; }
    for (const id of solvedIds) if (!heard.ids.has(id)) { heard.ids.add(id); if (id !== room.meId) playOtherCorrect(); }
  }, [round.id, solvedIds.join()]);
  async function submit(event) {
    event.preventDefault(); if (disabled || !answer.trim()) return;
    const id = round.id;
    const result = await action('answer:submit', { answer, roundId: id, requestId: makeId() });
    if (roundIdRef.current !== id) return;
    if (result) {
      if (result.correct) playCorrect();
      setFeedback(result.correct ? { type: 'success', points: result.points, elapsedMs: result.elapsedMs } : { type: 'error' });
      setAnswer('');
    }
  }
  const reveal = ['results', 'finished'].includes(room.phase);
  const correct = solved => t('Correto! +{points} pontos · {time}', { points: solved.points, time: secs(solved.elapsedMs) });
  const nextIn = Math.min(3, Math.max(0, Math.ceil((room.advanceAt - serverNow) / 1000)));
  return <section className="panel question-panel">
    <div className="section-heading"><div><span className="question-theme">{round.theme}</span><span className="eyebrow">{t('Pergunta {n} · objetivo: {points} pontos', { n: round.number, points: room.targetPoints })}</span></div>
      <strong className="timer" aria-label={t('Tempo restante')}>{reveal ? t('Terminou') : countdown ? t('Começa em {n}', { n: countdown }) : `${remaining.toFixed(1)} s`}</strong></div>
    <progress max={round.durationMs} value={reveal ? 0 : countdown ? round.durationMs : remaining * 1000} aria-label={t('Tempo da ronda')} />
    <h2 className="prompt">{countdown && !reveal ? t('Prepara-te…') : round.prompt ?? t('A receber pergunta…')}</h2>
    {round.imageUrl && <QuestionImage key={round.imageUrl} url={round.imageUrl} />}
    {!reveal && <form onSubmit={submit} className="answer-form">
      <label htmlFor="answer">{t('A tua resposta')}</label>
      <div className="row"><input ref={inputRef} id="answer" autoComplete="off" autoCapitalize="off" spellCheck="false" maxLength="120" value={answer} onChange={e => setAnswer(e.target.value)} disabled={disabled} placeholder={t(me?.participating ? 'Escreve e carrega Enter' : 'Jogas na próxima partida')} /><button className="primary" disabled={disabled || !answer.trim()}>{t('Enviar')}</button></div>
    </form>}
    <div className="feedback" role="status" aria-live="polite">
      {round.mine ? <p key={`ok-${round.id}`} className="success pop">{correct(round.mine)}</p> : feedback ? <p key={`ok-${round.id}`} className={feedback.type === 'success' ? 'success pop' : 'error'}>{feedback.type === 'success' ? correct(feedback) : t('Ainda não. Tenta outra resposta.')}</p> : !me?.participating ? <p className="notice">{t('Estás a assistir. Participas na próxima partida.')}</p> : null}
    </div>
    {reveal && <div className="revealed"><span className="muted">{t(round.answers.length > 1 ? 'Respostas aceites' : 'Resposta')}</span><p><strong>{round.answers.join(' / ')}</strong></p></div>}
    {reveal && round.imageCredit && <p className="muted small">{t('Fotografia: {credit}', { credit: round.imageCredit })}{round.imageSource && <> · <a href={round.imageSource} target="_blank" rel="noreferrer">{t('Fonte')}</a></>}{round.imageLicense && <> · <a href={round.imageLicense} target="_blank" rel="noreferrer">{t('Licença')}</a></>}</p>}
    {room.phase === 'results' && <p className="muted" role="status">{t(room.winnerId ? 'Ranking final em {n} s…' : 'Próxima pergunta em {n} s…', { n: nextIn })}</p>}
  </section>;
}

function App() {
  const t = useT();
  const show = useMessage();
  useEffect(() => { document.title = `${QUIZ_NAME} | JKA games`; }, []);
  const [connected, setConnected] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [room, setRoom] = useState(null);
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState(() => shortCode(new URLSearchParams(location.search).get('sala') ?? ''));
  const [invite, setInvite] = useState(() => code.length === 6 ? code : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [offset, setOffset] = useState(0);
  const [dirty, setDirty] = useState(false);
  const pendingRef = useRef(false);
  const saveRef = useRef(null);
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
    const removed = message => () => {
      setStored(SESSION_KEY, null); setRoom(null); setDirty(false); setCode(''); setInvite('');
      history.replaceState(null, '', location.pathname);
      setError(message);
    };
    const closed = removed('O host fechou a sala. Cria uma nova sala ou entra noutra.');
    const kicked = removed('O host expulsou-te da sala.');
    socket.on('connect', connect); socket.on('disconnect', disconnect); socket.on('connect_error', connectionError);
    socket.on('room:state', state); socket.on('session:replaced', replaced); socket.on('room:expired', expired); socket.on('room:closed', closed); socket.on('room:kicked', kicked);
    socket.connect();
    const interval = setInterval(() => { if (socket.connected) synchronize(); }, 20000);
    return () => {
      mounted = false; clearInterval(interval);
      socket.off('connect', connect); socket.off('disconnect', disconnect); socket.off('connect_error', connectionError);
      socket.off('room:state', state); socket.off('session:replaced', replaced); socket.off('room:expired', expired); socket.off('room:closed', closed); socket.off('room:kicked', kicked); socket.disconnect();
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
  async function start() {
    // Unsaved edits would otherwise block the match; save them on the way in.
    if (dirty && !(await saveRef.current?.())) return;
    await action('game:start');
  }
  async function leave() {
    if (isHost && room.players.some(p => p.id !== room.meId && !p.left) && !confirm(t('Fechar a sala para todos? Os outros jogadores voltam ao início.'))) return;
    const result = await action('room:leave');
    if (result) { setStored(SESSION_KEY, null); setRoom(null); setDirty(false); setCode(''); setInvite(''); history.replaceState(null, '', location.pathname); }
  }
  async function copyLink() {
    const url = `${location.origin}${location.pathname}?sala=${room.code}`;
    try { await navigator.clipboard.writeText(url); setNotice('Link copiado. Envia-o aos teus amigos.'); }
    catch { setNotice({ text: 'Link da sala: {url}', vars: { url } }); }
  }
  const disabled = !connected || busy || restoring;
  const canStart = !disabled && room?.players.some(p => p.connected);
  return <main>
    <header className="site-header"><div className="brand-row"><BrandLogo /><div className="game-identity"><strong>{QUIZ_NAME}</strong><span>{t('Um jogo JKA games')}</span><Stars /></div></div>
      <div className="row"><SoundToggle /><LanguageToggle /><span className={`connection ${connected ? 'online' : ''}`} role="status">{t(restoring ? 'A recuperar sessão…' : connected ? 'Ligado' : 'A ligar…')}</span></div></header>
    {error && <div className="banner error" role="alert">{show(error)}</div>}
    {notice && <div className="banner" role="status">{show(notice)}</div>}
    {room && !connected && <div className="banner notice">{t('A ligação caiu. A reconexão é automática; os pontos mantêm-se e o tempo da ronda continua.')}</div>}
    {!room ? <div className="home">
      {invite ? <section className="panel invite">
        {/* Invited players only need a nickname; creating a room is a deliberate detour. */}
        <span className="eyebrow">{t('Foste convidado')}</span><h1>{QUIZ_NAME}</h1>
        <p>{t('Foste convidado para jogar na sala')}</p><p className="invite-code">{invite}</p>
        <form onSubmit={e => { e.preventDefault(); enter('join'); }}>
          <label htmlFor="nickname">{t('O teu nickname')}<input id="nickname" maxLength="24" value={nickname} onChange={e => setNickname(e.target.value)} placeholder={t('Como te chamas no jogo?')} autoComplete="nickname" autoFocus /></label>
          <button className="primary full" disabled={disabled || !nickname.trim()}>{t('Entrar na sala {code}', { code: invite })}</button>
        </form>
        <button className="quiet full" onClick={() => { setInvite(''); setCode(''); history.replaceState(null, '', location.pathname); }}>{t('Não é esta sala? Cria uma sala nova')}</button>
        {!connected && <button className="quiet full" onClick={() => socket.connect()}>{t('Voltar a ligar')}</button>}
        {getStored(SESSION_KEY) && connected && <button className="quiet full" onClick={() => { socket.disconnect(); socket.connect(); }}>{t('Recuperar sessão anterior')}</button>}
      </section> : <section className="panel"><span className="eyebrow">{t('Perguntas e adivinhas')}</span><h1>{QUIZ_NAME}</h1>
        <p>{t('Junta os amigos. Quem sabe mais depressa?')}</p>
        <p className="muted">{t('Salas privadas para 1 a 20 pessoas. Testa sozinho ou convida os amigos para jogar no computador ou no telemóvel.')}</p>
        {/* Enter in the nickname joins when a full code is typed, otherwise creates a room. */}
        <form onSubmit={e => { e.preventDefault(); enter(code.length === 6 ? 'join' : 'create'); }}>
          <label htmlFor="nickname">{t('O teu nickname')}<input id="nickname" maxLength="24" value={nickname} onChange={e => setNickname(e.target.value)} placeholder={t('Como te chamas no jogo?')} autoComplete="nickname" /></label>
          <button type="button" className={code.length === 6 ? 'full' : 'primary full'} disabled={disabled || !nickname.trim()} onClick={() => enter('create')}>{t('Criar sala privada')}</button>
        </form>
        <div className="divider">{t('ou entra numa sala')}</div>
        <form onSubmit={e => { e.preventDefault(); enter('join'); }}><label htmlFor="code">{t('Código da sala')}<input id="code" className="code-input" value={code} onChange={e => setCode(shortCode(e.target.value))} placeholder="ABC234" maxLength="6" autoCapitalize="characters" autoComplete="off" /></label>
          <button className={code.length === 6 ? 'primary full' : 'full'} disabled={disabled || !nickname.trim() || code.length !== 6}>{t('Entrar na sala')}</button></form>
        {!connected && <button className="quiet full" onClick={() => socket.connect()}>{t('Voltar a ligar')}</button>}
        {getStored(SESSION_KEY) && connected && <button className="quiet full" onClick={() => { socket.disconnect(); socket.connect(); }}>{t('Recuperar sessão anterior')}</button>}
      </section>}
      <Rules />
    </div> : <>
      <section className="room-heading"><div><span className="eyebrow">{t('Sala privada')}</span><h1 className="room-code">{room.code}</h1></div>
        <div className="row wrap"><button onClick={copyLink}>{t('Copiar convite')}</button><button className={isHost ? 'quiet danger' : 'quiet'} disabled={disabled} onClick={leave}>{t(isHost ? 'Fechar sala' : 'Sair da sala')}</button></div></section>
      <div className="game-layout"><div className="game-main">
        {room.phase === 'lobby' && <section className="panel"><h2>{t(isHost ? 'A tua sala está pronta' : 'À espera do host')}</h2>
          <p>{t(isHost ? 'Partilha o convite e edita as perguntas abaixo. Quando todos estiverem aqui, inicia a partida.' : 'O host está a preparar as perguntas. A partida começa para todos ao mesmo tempo.')}</p>
          <p className="muted">{t('{count} perguntas aleatórias · {seconds} s por pergunta · ganha aos {points} pontos', { count: room.questionCount, seconds: room.settings.durationSeconds, points: room.settings.targetPoints })} · {t(room.settings.fuzzy ? 'aceita pequenos erros de escrita' : 'não aceita erros de escrita')}</p>
          <p className="muted">{t('Categorias: {list}', { list: room.settings.themes.length === room.categories.length ? t('todas') : room.settings.themes.join(', ') })}</p>
          {isHost && <><button className="primary" disabled={!canStart} onClick={start}>{t(dirty ? 'Guardar e iniciar partida' : 'Iniciar partida')}</button><p className="muted small">{t('Podes testar sozinho ou jogar com amigos, até 20 pessoas.')}</p></>}
        </section>}
        {room.round && <Question room={room} connected={connected} busy={busy} action={action} offset={offset} />}
        {room.phase === 'finished' && <section className="panel"><span className="eyebrow">{t('Ranking final')}</span><h2>{room.winnerId ? t('{name} venceu!', { name: room.players.find(p => p.id === room.winnerId)?.name }) : t('Partida terminada')}</h2>
          <p>{t('Objetivo de {points} pontos atingido. Confere a pontuação, os acertos e os tempos na classificação.', { points: room.targetPoints })}</p>
          {isHost ? <><button className="primary" disabled={!canStart} onClick={start}>{t(dirty ? 'Guardar e jogar novamente' : 'Jogar novamente')}</button><p className="muted small">{t('A nova partida começa do zero. Podes editar as perguntas antes.')}</p></> : <p className="muted">{t('O host pode iniciar outra partida.')}</p>}
        </section>}
        {isHost && ['lobby', 'finished'].includes(room.phase) && <Editor key={`${room.code}-${room.meId}`} room={room} busy={busy} connected={connected} action={action} onDirty={setDirty} saveRef={saveRef} />}
        <Rules fuzzy={room.settings.fuzzy} />
      </div><Ranking room={room} isHost={isHost} disabled={disabled} action={action} /></div>
    </>}
    <footer>{t('{name} · um jogo JKA games', { name: QUIZ_NAME })} · <a href="/">{t('Todos os jogos')}</a></footer>
  </main>;
}

function Root() {
  const [lang, setLangState] = useState(loadLang);
  useEffect(() => { document.documentElement.lang = lang === 'en' ? 'en' : 'pt-PT'; }, [lang]);
  useEffect(() => {
    // Audio may only start after a user gesture; joining or answering always involves one.
    window.addEventListener('pointerdown', unlockAudio, { passive: true }); window.addEventListener('keydown', unlockAudio);
    return () => { window.removeEventListener('pointerdown', unlockAudio); window.removeEventListener('keydown', unlockAudio); };
  }, []);
  const setLang = value => { saveLang(value); setLangState(value); };
  // Older invitations used /?sala=CODE. Keep them opening the quiz directly.
  const quizRoute = location.pathname.replace(/\/+$/, '') === QUIZ_PATH || new URLSearchParams(location.search).has('sala');
  return <LangContext.Provider value={{ lang, setLang }}>{quizRoute ? <App /> : <GamesHome />}</LangContext.Provider>;
}

createRoot(document.getElementById('root')).render(<Root />);
