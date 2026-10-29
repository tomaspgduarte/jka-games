# CLAUDE.md

Guia para agentes de AI neste repositório. O [README.md](README.md) é a referência completa para utilizadores; este ficheiro resume o que é preciso saber antes de mexer no código.

## O projeto

- **JKA games** é a marca; **Trigo** é o primeiro (e por agora único) jogo: quiz multijogador em tempo real entre amigos.
- `/` mostra o catálogo de jogos (`GamesHome`); `/trigo` abre o Trigo (`App`). Convites antigos `/?sala=CODIGO` também abrem o Trigo e têm de continuar a funcionar.
- Interface e mensagens em **português de Portugal** (tu, «ecrã», «ligação», «guardar»). Por pedido do utilizador, as **252 perguntas e os oito temas estão em inglês**; preservar nomes/títulos originais e as alternativas portuguesas das respostas. Comentários no código em inglês, curtos, a explicar o porquê.
- Nome interno antigo: `popsala` (pacote, `render.yaml`, imagem Docker, chave `popsala-session` no `sessionStorage`). Não renomear a chave da sessão sem pensar nas sessões existentes.

## Comandos

```sh
npm ci              # instalar (usar sempre ci, versões fixadas no lock)
npm run dev         # servidor + Vite em middleware, http://localhost:3000
npm run build       # frontend para dist/
npm start           # produção (exige dist/)
npm test            # node --test tests/*.test.js (~15 s, abre portas locais)
npm run test:load   # 20 jogadores × 10 rondas
```

Node >= 22.12 (recomendado 24). Mudanças no backend exigem reiniciar `npm run dev`.

## Arquitetura

Um único processo Node serve frontend e Socket.IO. **Todo o estado vive em memória** (`rooms` em `game.js`): sem base de dados, sem contas, uma só instância. Reiniciar apaga as salas.

| Ficheiro | Papel |
| --- | --- |
| `server/index.js` | Arranque, Vite em dev, `dist/` em produção, encerramento controlado |
| `server/app.js` | Express + helmet (CSP), Socket.IO (verificação de origem, 3 MB de buffer), `/health`, `/media/:code/:roundId` |
| `server/game.js` | Salas, sessões, host, rondas, temporizadores, pontuação, limpeza; `validateConfig`, `shuffleQuestions` |
| `server/answers.js` | `normalize`, Damerau-Levenshtein limitado, `isCorrect`, `pointsFor` |
| `server/images.js` | Validação de data URLs PNG/JPEG/WebP (bytes mágicos, máx. 300 KB) |
| `server/defaults.js` | Configuração inicial de cada sala nova |
| `server/content/text-questions.js` | 240 perguntas de texto, agrupadas por tema (`'pergunta', 'resp1\|resp2'`) |
| `server/content/photo-questions.json` | 12 perguntas com fotografia em base64 + créditos (~1,2 MB) |
| `client/src/main.jsx` | Todo o frontend: `GamesHome`, `App`, `Editor`, `Question`, `Ranking`, `Rules` |
| `client/src/styles.css` | Tema azul escuro; cores só em variáveis `:root` |
| `tests/` | Integração com clientes Socket.IO reais (`helpers.js`), conteúdo do banco, carga |
| `examples/` | JSON para importar: banco completo, um por tema, resumo de contagens |

### Protocolo Socket.IO

Pedidos com ack `{ ok, ...}` ou `{ ok: false, error }`: `clock:sync`, `room:create`, `room:join`, `room:resume`, `room:leave`, `config:save`, `game:start`, `answer:submit`.
Eventos do servidor: `room:state` (snapshot por jogador), `session:replaced`, `room:expired`.

Fases da sala: `lobby` → `question` → `results` (3 s) → `question` … → `finished` → (`game:start` de novo).

## Invariantes que não se podem partir

- **O relógio é do servidor.** O tempo de resposta é `performance.now()` na receção menos `round.startMono`. Nunca aceitar tempos, pontos ou datas do cliente. O prazo é verificado em cada resposta, não só no temporizador.
- **Não divulgar informação antes do tempo.** `snapshot()` só envia a pergunta/imagem depois de `startMono`, as respostas e créditos só em `results`/`finished`, e a `config` só ao host e fora de partida. `getRoundImage` aplica a mesma regra.
- `answer:submit` usa `socket.volatile` no cliente: respostas não ficam em fila através de uma desconexão. Reenvios com o mesmo `requestId` devolvem o recibo original.
- Mensagens de erro para o utilizador: lançar `GameError` (texto em português). Outros erros são registados e chegam ao cliente como «Erro interno».
- Limites (validados no servidor e repetidos no `importFile` do cliente; se mudar um, mudar ambos e o README): 1–500 perguntas, tema 60, pergunta 500, 1–10 respostas de 120, duração 5–120 s, objetivo 1–1000, textos 200 KB, imagem 300 KB, total 2 MB, 20 entradas por sala, 100 salas por processo.
- Fórmula de pontos: `max(1, min(10, ceil(10 × (1 − elapsed / duration))))`. Ordenação: pontos ↓, acertos ↓, soma dos tempos ↑, nickname.

## Convenções

- Estilo denso e funcional, como o código existente: funções pequenas dentro de `attachGame`, sem classes nem frameworks extra. Sem TypeScript, sem bibliotecas novas sem necessidade.
- Temporizadores do jogo passam por `later()`/`cancel()` para que `dispose()` os limpe (os testes dependem disso).
- Opções de tempo (`countdownMs`, `resultsMs`, `hostGraceMs`, `emptyTtlMs`, …) são injetáveis em `attachGame` para os testes correrem depressa.
- Ao mudar comportamento: atualizar o README (secção correspondente) e acrescentar uma secção datada ao [TESTES.md](TESTES.md) com o que foi verificado e como.
- Banco de perguntas: texto original, sem letras de músicas, factos datados em vez de plantéis atuais. Ao mudar contagens, atualizar `FONTES-PERGUNTAS.md`, `examples/resumo-banco.json`, os ficheiros em `examples/` e `tests/content.test.js`.
- Fotografias: só com licença adequada e créditos registados em [IMAGENS.md](IMAGENS.md). As três da VLR.gg (aspas, TenZ, Sacy) **não têm licença confirmada** e devem ser substituídas antes de uma publicação pública.

## Limitações conhecidas / direções

- `game.js` mistura infraestrutura de salas (códigos, sessões, host, reconexão) com regras do quiz. Um segundo jogo JKA deve primeiro extrair essa camada comum.
- `main.jsx` é um ficheiro único; dividir em componentes antes de acrescentar outro jogo.
- Sem persistência nem escalonamento horizontal: não usar várias réplicas nem PM2 em cluster.
