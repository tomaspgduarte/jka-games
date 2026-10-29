# JKA games

**JKA games é a marca principal. Trigo é o primeiro jogo**, de perguntas e adivinhas. A página `/` apresenta os jogos da marca; o Trigo abre em `/trigo`, com o seu próprio nome no cabeçalho e no título do browser. Os convites antigos `/?sala=CODIGO` continuam a abrir diretamente o jogo. O repositório é da marca e pode acolher outros jogos com nomes próprios.

Jogo de adivinhas entre amigos: React + Vite no browser, Node.js + Express + Socket.IO no servidor. Interface simples em português, com um botão **English** no cabeçalho para mudar a interface para inglês (as perguntas continuam como estão no banco) e um botão 🔊/🔇 para o som. Sem serviços externos nem contas de jogador. Perguntas aleatórias com imagens opcionais, avanço automático, 1–10 pontos por acerto e vitória por objetivo de pontos.

Estilo «Morabeza», inspirado em Cabo Verde: fundo azul do mar, cartões claros com sombra, botões principais no amarelo das estrelas da bandeira, tema da pergunta no vermelho da bandeira e as dez estrelas no cabeçalho. A letra é a Baloo 2 (licença OFL), instalada como pacote `@fontsource/baloo-2` e servida pelo próprio jogo, sem pedidos ao Google. As cores estão centralizadas nas variáveis de `client/src/styles.css`; os cartões (`.panel`) redefinem `--muted`, `--focus` e `--link` para o fundo claro.

Logo da marca em `client/public/jka-games-logo.png`, com fundo transparente, aplicado no cabeçalho e apresentado em branco por CSS para contrastar com o tema escuro. O «g» de «games» foi corrigido com edição de imagem (imagegen), mantendo o desenho manuscrito. O nome do jogo é apresentado em separado. O nome interno do pacote/pasta continua a ser `popsala`.

## Correr no teu computador

Instala **Node.js 24 LTS** (também funciona com Node >= 22.12) a partir de https://nodejs.org/. Abre um terminal nesta pasta e executa:

```sh
npm ci
npm run dev
```

Abre **http://localhost:3000**. Um único processo serve a interface e a ligação em tempo real. O frontend atualiza automaticamente durante desenvolvimento; se mudares o backend, reinicia o comando.

Para a versão de produção:

```sh
npm run build
npm start
```

Para parar, usa Ctrl+C. O servidor termina de forma controlada. As salas são temporárias e desaparecem ao parar ou reiniciar o processo.

### Amigos na mesma rede Wi-Fi

Com o servidor ligado, os amigos abrem `http://IP-LOCAL-DO-TEU-COMPUTADOR:3000`, substituindo o IP pelo endereço local mostrado nas definições de rede. Usa esse endereço também no teu browser antes de copiares o convite: um link com `localhost` aponta para o computador de quem o abre. Pode ser necessário permitir a aplicação na firewall. O computador deve continuar ligado.

Para amigos noutras redes, publica o projeto num servidor; segue a secção abaixo.

## Como jogar

1. Escolhe um nickname e cria uma sala privada.
2. Copia o convite ou partilha o código de 6 caracteres.
3. O host escolhe as categorias e as opções da partida no painel **Opções da partida**. As alterações por guardar são guardadas automaticamente ao carregar em **Guardar e iniciar partida** (ou **Guardar e jogar novamente**); também podes usar **Guardar opções**.
4. Os amigos escolhem nicknames diferentes e entram pelo convite ou código. Quem abre um link de convite vê um ecrã só para entrar: o código da sala em grande, o campo do nickname e o botão **Entrar na sala** (o Enter também entra); criar outra sala fica num link discreto por baixo. Sem convite, **Criar sala privada** é o botão destacado até se escrever um código completo, e aí passa a ser **Entrar na sala**.
5. O host pode iniciar **sozinho para testar** ou com amigos. A sala suporta **1 a 20 jogadores**; podes jogar com 6 ou mais.
6. Há uma contagem de 3 segundos apenas antes da primeira pergunta. Escreve e carrega Enter para responder.
7. Depois de todos acertarem ou de o tempo acabar, aparece a resposta e a classificação durante **3 segundos**. A próxima pergunta começa automaticamente, sem botão nem nova contagem inicial.
8. **Ganha o primeiro jogador a atingir ou ultrapassar o objetivo de pontos.** Nesse instante a ronda termina; os restantes envios dessa ronda já não pontuam. Após os 3 segundos de resposta, aparece o ranking final. O host pode editar perguntas/objetivo e iniciar outra partida, com os pontos a zero.

O host define **Pontos para ganhar**, entre 1 e 1000; o valor inicial é **50**. A partida não tem um número fixo de rondas. As perguntas são sempre baralhadas: todas são usadas uma vez antes de voltar a baralhar. Se ainda ninguém tiver atingido o objetivo, o jogo continua num novo ciclo. Havendo várias perguntas, a última de um ciclo não se repete imediatamente no seguinte. Com uma só pergunta, ela repete-se até alguém atingir o objetivo.

Quem entra a meio assiste e só participa na próxima partida. A lista de jogadores mostra ligação, host e quem já acertou. As respostas ficam no servidor: nem o host as vê antes de a ronda terminar, por isso também joga em igualdade.

### Pontuação e medição do tempo

- Uma resposta correta vale **entre 1 e 10 pontos**, em números inteiros.
- **O primeiro a acertar ganha sempre 10 pontos**, seja qual for o tempo. Quem acertar **até 1 segundo depois do primeiro** também ganha 10 (contam como «ao mesmo tempo»).
- Os seguintes ganham os pontos pelo tempo, `max(1, min(10, ceil(10 × (1 − elapsedMs / durationMs))))` (10 no primeiro décimo do tempo, 9 no seguinte, até 1 no último), **menos 1 ponto por cada jogador que já acertou** nessa ronda, com um mínimo de 1.
- Exemplo numa ronda de 20 s: o 1.º acerta aos 5 s (**10**), o 2.º aos 5,5 s (**10**), o 3.º aos 8 s fica com 6 − 2 = **4** e o 4.º aos 10 s fica com 5 − 3 = **2**. O total da partida soma os pontos das rondas; 10 é o máximo por acerto.
- Respostas erradas não retiram pontos. Cada jogador só pontua uma vez em cada ronda.
- Sons: quando acertas toca um arpejo curto e o «Correto!» aparece com uma pequena animação; quando outro jogador acerta toca um «pop» discreto. Os sons são gerados no browser (Web Audio), sem ficheiros, e só começam depois do primeiro clique ou tecla, como os browsers exigem. O botão 🔊/🔇 no cabeçalho do Trigo liga e desliga o som, e a escolha fica guardada no browser.
- O relógio de referência é **o do servidor**, usando `performance.now()` (monotónico). Começa no instante de início programado e termina na receção da resposta correta. O servidor ignora pontos, datas ou tempos enviados pelo cliente.
- Inclui o tempo de a pergunta chegar, a leitura, a escrita e o envio da resposta. **Não há compensação de latência**. A precisão apresentada de 0,001 s não significa igualdade de condições na rede.
- O contador visual é uma estimativa baseada no relógio sincronizado por ida e volta; o servidor é sempre quem decide se o prazo expirou. Atualizar a página não reinicia o tempo.
- Uma resposta recebida antes do início ou no/pós prazo não conta. O servidor verifica o prazo na própria receção, mesmo se o evento do temporizador tiver atrasado.
- A pergunta só é enviada aos jogadores quando começa. As respostas e perguntas futuras não são enviadas aos participantes; o host recebe a lista editável no lobby e no fim.
- Ordenação: pontos descendentes, acertos descendentes, soma dos tempos dos acertos ascendente, nickname por ordem alfabética para desempate restante.

### Validação das respostas

Ignora maiúsculas/minúsculas e acentos, converte pontuação em espaços e reduz espaços repetidos. `LISBÓA!` equivale a `Lisboa`. Usa alternativas para sinónimos, traduções, abreviaturas ou respostas com palavras diferentes.

Com **Aceitar pequenos erros de escrita** ligado, cada resposta esperada com 5–9 caracteres normalizados aceita uma edição, e com 10 ou mais aceita duas: inserção, remoção, substituição ou troca de duas letras adjacentes. Respostas esperadas com até 4 caracteres exigem correspondência exata após normalização. As sequências numéricas têm de ser iguais, mesmo em respostas longas: `Toy Story 4` não conta como `Toy Story 3`. É uma aproximação textual, não uma avaliação semântica; desliga a tolerância para perguntas com nomes muito parecidos.

Bloqueia a repetição de uma tentativa normalizada. Intervalo mínimo de 300 ms e máximo de 50 tentativas por jogador/ronda. Reenvios do mesmo pedido devolvem o recibo original e não somam pontos. O browser não guarda respostas para enviar depois de uma reconexão.

## Perguntas e categorias

O jogo inclui **436 perguntas: 424 de texto e 12 com fotografia**, em 14 categorias: VALORANT, Counter-Strike, F1, basquetebol, futebol, hip-hop/rap, músicas, personagens, Cabo Verde, desporto de Cabo Verde, memes, memes brasileiros, memes do futebol e emojis (adivinhar filmes, séries, jogos e canções). Inclui «Quem é o jogador?» com fotografias de aspas, TenZ e Sacy. O banco é carregado automaticamente nas novas salas. Consulta [fontes e resumo](FONTES-PERGUNTAS.md) e [créditos das fotografias](IMAGENS.md).

No lobby, o host tem o painel **Opções da partida**:

- **Segundos por pergunta** (5–120), **Pontos para ganhar** (1–1000) e **Aceitar pequenos erros de escrita**.
- **Categorias**: um botão por categoria, com o número de perguntas. Todas começam escolhidas. Toca numa para a tirar ou voltar a pôr; **Todas** volta a escolher todas, ou tira todas de uma vez quando já estão todas escolhidas. É preciso pelo menos uma.
- O total de perguntas escolhidas aparece no topo do painel, e os outros jogadores veem no lobby que categorias vão sair.
- As alterações ficam guardadas com **Guardar opções** ou automaticamente ao **iniciar a partida**.

A ordem é sempre aleatória e só entram perguntas das categorias escolhidas, mesmo quando o baralho recomeça. As perguntas e respostas nunca são enviadas aos jogadores, nem ao host: o browser recebe só os nomes e tamanhos das categorias e, durante a ronda, a pergunta em curso. As fotografias são servidas por HTTP apenas quando a sua pergunta começa; o tempo de carregamento faz parte da latência e não é descontado.

As perguntas já não se editam na interface. Para acrescentar ou corrigir perguntas, edita `server/content/text-questions.js` (ou `server/content/photo-questions.json`) e reinicia o servidor. Em `examples/` há uma cópia do banco em JSON, completo e por categoria, para consulta. Limites validados pelo servidor: 1–500 perguntas por banco; tema de 60 caracteres; pergunta de 500; 1–10 alternativas por pergunta, de 120 caracteres cada; textos e créditos até 200 KB; imagem até 300 KB; total com imagens até 2 MB.

## Desconexões e sessões

- O browser guarda um token aleatório em `sessionStorage`, por separador. Uma atualização ou quebra de ligação recupera jogador, pontuação e acerto atual, enquanto a sala existir. Se o armazenamento estiver bloqueado, a ligação atual funciona mas pode não recuperar após atualizar.
- Mantém o mesmo separador para voltar. Um novo separador/dispositivo precisa de outro nickname. Se alguém possuir o mesmo token, a ligação mais recente substitui a anterior; nunca partilhes esse token.
- Uma desconexão mantém o participante e o tempo continua. O servidor espera pelos participantes que ainda não acertaram até ao limite de tempo, mesmo que estejam desligados.
- O host mantém o controlo se regressar em 30 s; após esse prazo o primeiro jogador ligado por ordem de entrada recebe o controlo. Se ninguém estiver ligado, o próximo a recuperar a sessão torna-se host. Um host antigo não retira a função ao novo ao regressar. Isto só acontece quando o host perde a ligação.
- **Sair da sala** invalida a sessão. O jogador fica identificado como «Saiu» na classificação; poderá entrar de novo como uma nova entrada/espectador. Uma sala aceita no máximo 20 entradas ao longo da sua vida; cria outra para renovar as vagas.
- Para o host, o botão chama-se **Fechar sala**: pede confirmação quando há outros jogadores e fecha a sala para todos, em qualquer fase. Os restantes voltam ao início com o aviso «O host fechou a sala».
- O host pode **expulsar** um jogador com o botão **Expulsar** na lista de jogadores, em qualquer fase. O expulso volta ao início com o aviso «O host expulsou-te da sala», perde a sessão e fica como «Expulso» na classificação, com os pontos que tinha. A meio de uma ronda deixa de contar como participante, por isso a ronda pode terminar logo se todos os restantes já acertaram. Não é um banimento: com o código, pode voltar a entrar como nova entrada.
- Salas sem jogadores ligados expiram após cerca de 30 minutos; qualquer sala expira após 12 horas. A limpeza corre a cada minuto. Máximo de 100 salas por processo. Há limites de frequência de pedidos e de criação de salas para proteger o serviço de erros e uso abusivo básico.
- Os códigos são convites, não autenticação: qualquer pessoa com o código/link pode entrar. Adequado a grupos de amigos; sem contas, moderação ou proteção contra abuso deliberado em grande escala.

## Publicar online com WebSockets

**Frontend e backend ficam no mesmo serviço Node**, no mesmo domínio. Não publiques só a pasta `dist` num alojamento estático: faltaria o servidor das salas. Usa HTTPS; o Socket.IO passa a usar WSS automaticamente. Tem fallback HTTP long polling para redes que bloqueiem WebSocket.

### Render (configuração incluída)

1. Coloca o conteúdo desta pasta num repositório Git teu e envia-o para GitHub/GitLab/Bitbucket.
2. No Render, cria um **Web Service** ligado a esse repositório (ou usa Blueprint com `render.yaml`). Se o projeto estiver dentro de outra pasta, define essa pasta como Root Directory.
3. Runtime: Node. Build: `npm ci && npm run build`. Start: `npm start`. Health check: `/health`.
4. Mantém **uma única instância**. Escolhe uma região próxima dos jogadores (por exemplo Frankfurt para Europa) e um plano sem suspensão se precisares de disponibilidade contínua. Verifica o preço e as condições apresentados pelo fornecedor.
5. Partilha o URL HTTPS fornecido pelo Render. A variável `PORT` é fornecida pelo serviço e o servidor escuta em `0.0.0.0`. Não precisas de portas diferentes para WebSockets.

O ficheiro `render.yaml` não cria contas nem contrata um plano por si só. O plano é escolhido no fornecedor. Documentação oficial: [Web Services](https://render.com/docs/web-services) e [WebSockets](https://render.com/docs/websocket).

### Link público temporário para amigos (Cloudflare Tunnel)

Permite jogar de outras redes sem configurar o router. O computador tem de ficar ligado e sem suspensão, com os dois processos abaixo ativos. Não é alojamento independente nem tem garantia de disponibilidade. Cada arranque do túnel gera outro endereço. As salas continuam a viver só na memória do servidor.

Instala `cloudflared` pela [fonte oficial](https://developers.cloudflare.com/tunnel/downloads/). Primeiro prepara e inicia a versão de produção:

```sh
npm run build
PORT=3002 HOST=127.0.0.1 NODE_ENV=production npm start
```

Noutro terminal, inicia o túnel:

```sh
cloudflared tunnel --no-autoupdate --url http://127.0.0.1:3002 --protocol http2
```

Abre o endereço HTTPS `trycloudflare.com` mostrado, cria uma sala e copia o convite desse endereço. Quem estiver noutra rede usa esse convite; o código de uma sala de outro processo (por exemplo o servidor de desenvolvimento na porta 3000) não funciona aqui. Usa sempre a versão de produção para o túnel. Terminar o túnel desativa o link; terminar o servidor também apaga as salas. [Limitações oficiais](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

### Docker / VPS

```sh
docker build -t popsala .
docker run --rm --name popsala -p 3000:3000 popsala
```

Para publicar num domínio com HTTPS num VPS, usa um reverse proxy como Caddy. Exemplo de `Caddyfile`, com Caddy e a aplicação no mesmo host:

```text
jogo.exemplo.pt {
    reverse_proxy 127.0.0.1:3000
}
```

Nesse caso, liga a porta do contentor apenas ao host com `-p 127.0.0.1:3000:3000`. O DNS do domínio deve apontar para o VPS. O reverse proxy deve permitir upgrade de WebSocket e ter timeout superior a 30 segundos. Usa um gestor de processos/restart policy para voltar a iniciar a aplicação depois de uma falha.

Configuração opcional:

| Variável | Valor por omissão | Função |
| --- | --- | --- |
| `PORT` | `3000` | Porta do serviço |
| `HOST` | `0.0.0.0` | Endereço de escuta; usa `127.0.0.1` num túnel local |
| `PUBLIC_ORIGIN` | mesmo host do pedido | Origem permitida, por exemplo `https://jogo.exemplo.pt`, sem `/` final |
| `NODE_ENV` | ambiente local | Usa `production` em alojamento |

Para definir variáveis localmente, usa o mecanismo normal do teu sistema ou `node --env-file=.env server/index.js`. O projeto não carrega `.env` automaticamente com `npm start`. Nunca envies ficheiros `.env` para um repositório público.

**Limite desta arquitetura:** o estado vive na memória de um processo. Não uses várias réplicas/autoscaling ou PM2 em cluster. Um reinício, publicação ou falha perde salas, temas não exportados e partidas ativas. Para esta primeira versão escolheu-se uma única instância para simplicidade e pouca latência. Persistência/Redis e coordenação das salas seriam uma evolução própria antes de escalar.

## Testes

```sh
npm test
npm run test:load
```

Os testes abrem portas locais temporárias e usam clientes Socket.IO reais. Incluem partida completa de 6 jogadores, 20 jogadores concorrentes, normalização, pontuação, duplicados, temporizador, informação privada, permissões, isolamento de salas, troca/recuperação de host, reconexão, expiração e fallback long polling. O teste de carga faz 10 rondas com 20 jogadores e mede o tempo até à confirmação local; não representa latência pela Internet. O relatório da execução entregue está em `TESTES.md`.

## Estrutura

```text
client/src/        interface React, estilos e traduções (i18n.js)
server/game.js    salas, relógio, pontuação e eventos
server/answers.js normalização e tolerância a gralhas
server/app.js     HTTP, Socket.IO e limites de origem/payload
server/index.js   arranque, frontend e encerramento
server/defaults.js perguntas iniciais
tests/            testes de integração e carga
examples/         cópia do banco em JSON (completo e por categoria)
Dockerfile        publicação em contentor
render.yaml       configuração para Render
```

O projeto usa versões exatas resolvidas em `package-lock.json`; instala com `npm ci` para reproduzir a versão testada. Consulta também a [documentação de Socket.IO](https://socket.io/docs/v4/).
