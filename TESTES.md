# Verificação da versão 1

Executado em 28 de outubro de 2026, em macOS com Node.js 24.22.0. Testes reais de protocolo via Socket.IO, com servidor HTTP e clientes ligados por portas locais temporárias.

## Resultados

- `npm run build`: compilação de produção concluída.
- `npm run dev`: arranque, interface e criação de sala verificados no browser.
- `npm test`: **16 testes passaram, 0 falharam**; duração aproximada de 14 segundos.
- `npm run test:load`: **20 jogadores × 10 rondas = 200 respostas corretas**, com exatamente um acerto por jogador em cada ronda. O objetivo elevado mantém a partida em curso; a vitória por pontos é verificada na integração.
- Confirmação das respostas no teste de carga: mediana **16,95 ms**, percentil 95 **22,34 ms**, máximo **23,09 ms**.
- `npm audit --omit=dev`: nenhuma vulnerabilidade conhecida nas dependências de produção no momento da execução.

As medições são da ida e volta de uma resposta até ao recibo, em localhost, com servidor e clientes no mesmo processo Node.js. Não são uma garantia de latência na Internet nem um teste de capacidade para centenas de salas.

## Fluxos cobertos

1. Normalização de maiúsculas, acentos, pontuação e espaços.
2. Gralhas e trocas de letras, modo estrito, proteção de números e anos.
3. Fórmula da pontuação e validação dos limites de configuração.
4. Partida completa com **6 jogadores**, três rondas sobre duas perguntas, continuação ao esgotar a lista, vencedor por pontos e nova partida com 7 jogadores.
5. Respostas erradas, respostas repetidas, reenvio do mesmo pedido, acerto único e limite de frequência.
6. Pergunta escondida antes do início, respostas privadas, proibição de editar durante a partida.
7. Tempo esgotado real de 5 segundos, respostas fora do prazo e tentativa de forjar tempos/pontos no cliente.
8. Reconexão durante uma ronda e depois de um acerto, sem perder pontos; substituição de uma ligação da mesma sessão.
9. Host a regressar durante o período de tolerância, transferência de controlo após desconexão e ao sair.
10. Isolamento entre salas, tokens inválidos, nickname duplicado, payloads malformados e revisão de configuração desatualizada.
11. Expiração de uma sala vazia, rejeição de origem alheia e fallback HTTP long polling.
12. **20 jogadores** com envios simultâneos duplicados, sem pontuação repetida, e rejeição de uma 21.ª entrada.
13. Imagem opcional servida apenas após o início, sem imagem nos eventos de pontuação; alternância aleatória imagem/texto; exportação com imagem; rejeição de SVG; resposta visível durante 3 segundos mesmo sem host ligado; objetivo de 15 pontos, ranking final e nova partida a zero. Pontuação verificada nos limites de 1–10 pontos por acerto.
14. Baralhamento em ciclos sem perder perguntas nem repetir imediatamente a última; objetivo validado entre 1 e 1000; compatibilidade com JSON antigo; envios posteriores à vitória rejeitados.
15. Banco de 252 perguntas e oito temas, 12 fotografias válidas, ausência de duplicados exatos e alternativas de resposta aceites; exportação/importação preservam imagens e créditos.
16. Banco completo de cerca de 1,2 MB transmitido e guardado por Socket.IO; pergunta com a fotografia de aspas servida corretamente, resposta aceite e créditos revelados apenas depois da resposta.

## Interface verificada no browser

- Página inicial, criação da sala e convite por link.
- Segundo jogador a entrar noutro separador, com a lista do lobby atualizada.
- Host a editar e guardar o texto de uma pergunta.
- Contagem de início sincronizada, pergunta e campo de resposta.
- Respostas certas enviadas por dois jogadores: feedback imediato, pontos e tempos distintos.
- Fim automático da ronda quando ambos acertam; respostas aceites e ranking com tempos.
- Ronda sem acertos a terminar pelo temporizador.
- Atualização da página a recuperar a sessão do host, incluindo pontuação e acerto.
- Imagens: escolha e compressão de uma imagem do computador, gravação e apresentação durante a pergunta, seguida de uma pergunta só com texto. A imagem de teste foi removida depois da verificação.
- Objetivo: alterado para 15 no painel, partida aleatória verificada até terminar aos 21 pontos, com 3 acertos; nova sala do utilizador pronta com objetivo de 50 e perguntas recuperadas por importação do JSON anterior.
- Banco: sala nova criada com 252 perguntas; filtro de VALORANT com 33 perguntas e paginação até às fotografias de aspas, TenZ e Sacy. Pergunta com fotografia de aspas testada numa sala separada: imagem apresentada e resposta `aspas` aceite, com 5 pontos e créditos VLR.gg visíveis depois do acerto.
- Vista estreita do painel (713 px) e outra vista de browser mais larga. Não foi feito teste num telemóvel físico.

## Limites da verificação

O Dockerfile e o ficheiro Render foram preparados, mas não foi criada uma conta, construída uma imagem Docker nem feita uma publicação num fornecedor. O jogo foi executado e verificado localmente. Também não foram simulados perda de pacotes de longa duração, várias regiões, falhas de processo ou ataques de grande escala. O estado em memória não sobrevive a reinícios, como descrito no README.

## Acesso público — 28 de outubro de 2026

Versão de produção servida por HTTPS através de Cloudflare Quick Tunnel, sem expor Vite. Seis clientes simultâneos pelo endereço público: banco completo com 252 perguntas, duas rondas, WebSockets, fallback polling, normalização, recibos duplicados sem pontos extra, reconexão com recuperação de estado, avanço automático e ranking final passaram. Confirmações das seis respostas: mediana ~94 ms, máximo ~134 ms. Clientes executados no mesmo computador, com tráfego pelo endereço público; não simula seis redes domésticas diferentes. O browser criou uma sala pública com sucesso. O acesso temporário requer o computador e ambos os processos ligados.

## Marca e nome do jogo — 29 de outubro de 2026

Compilação de produção concluída. No endereço público, verificados no browser: página inicial JKA games com o jogo Trigo; entrada em `/trigo` com título «Trigo | JKA games»; criação de sala com 252 perguntas; convite em `/trigo?sala=CODIGO`; retorno à página da marca e recuperação da sala pelo botão «Retomar sala»; convites antigos `/?sala=CODIGO` continuam a abrir o Trigo com o código preenchido. A exportação de perguntas usa o nome `trigo-perguntas.json`.

## Tema azul escuro e logo — 29 de outubro de 2026

Compilação de produção e verificação de diferenças concluídas. Revisão no browser pelo endereço público: catálogo, entrada no Trigo, criação de sala, lobby/editor, início de partida, campo de resposta, foco, temporizador, classificação e feedback de resposta errada. A sala de teste foi abandonada no fim. Cores centralizadas em variáveis CSS; contraste calculado de 14,13:1 para texto nos painéis, 9,02:1 para texto secundário nos painéis e 5,14:1 para texto branco nos botões principais. O PNG corrigido conserva transparência e dimensões de 1536 × 1024; o ficheiro servido pelo endereço público tem o mesmo SHA-256 do ficheiro local. O logo é apresentado em branco por CSS sobre o fundo escuro.

## Novos temas: Cabo Verde, memes e emojis — 29 de outubro de 2026

Executado em Windows 11 com Node.js 26.13.0. Banco alargado de 252 para **436 perguntas** (424 de texto + 12 com fotografia) em 14 temas, com seis temas novos: Cabo Verde (33), Desporto de Cabo Verde (26), Memes (34), Memes brasileiros (24), Memes do futebol (25) e Emojis (42). Os factos recentes (Mundial 2026, CAN 2023, Mundial de basquetebol 2023, Paris 2024, Vozinha, morna na UNESCO) foram conferidos nas fontes indicadas em `FONTES-PERGUNTAS.md`.

- `npm test`: **16 testes passaram, 0 falharam**; duração aproximada de 15 segundos. O teste do banco valida 436 perguntas, 14 temas, ausência de duplicados exatos, alternativas aceites e transmissão do banco completo por Socket.IO.
- `npm run build`: compilação de produção concluída.
- Ficheiros de `examples/` gerados a partir do banco do servidor; os oito ficheiros de temas antigos ficaram idênticos byte a byte.
- Browser (`npm run dev`): sala nova com 436/500 perguntas; filtro do editor com os 14 temas e contagens corretas; tema Emojis com 42 perguntas em 5 páginas e emojis apresentados corretamente.

Não foi jogada uma ronda no browser com uma pergunta específica dos temas novos, porque a ordem é aleatória; a aceitação das respostas é coberta pelos testes.

## Iniciar com alterações, fechar sala e inglês — 29 de outubro de 2026

Executado em Windows 11 com Node.js 26.13.0.

- **Iniciar com alterações por guardar:** antes, mudar qualquer opção no editor desativava **Iniciar partida** e **Jogar novamente** até se carregar em **Guardar perguntas**. Agora o botão passa a **Guardar e iniciar partida**, guarda e começa. No browser: sala nova, «Aceitar pequenos erros de escrita» desligado e partida iniciada com um clique.
- **Host fecha a sala:** `room:leave` do host apaga a sala e envia `room:closed` aos restantes. O teste de integração do host cobre agora um jogador normal a sair (a sala continua), o host a sair (a sala desaparece e o outro jogador recebe `room:closed`) e a sessão invalidada. No browser, com dois separadores a meio de uma partida: confirmação pedida ao host e o segundo jogador de volta ao início com o aviso. A perda de ligação continua a passar o controlo após 30 s.
- **Inglês:** botão **English**/**Português** no cabeçalho do catálogo e do Trigo, com a escolha guardada no browser. Verificados em inglês: lobby, editor, pergunta, resposta errada, classificação, confirmação de fecho, aviso de sala fechada e mensagens do servidor. Os textos das perguntas e os nomes dos temas ficam em português. Sem erros na consola.
- `npm test`: **16 testes passaram, 0 falharam**. `npm run build`: compilação de produção concluída.

Não foi testado num telemóvel físico; o cabeçalho passa a quebrar linha em ecrãs estreitos para caber o botão de idioma.

## Expulsar jogadores — 29 de outubro de 2026

Executado em Windows 11 com Node.js 26.13.0.

- Novo pedido `player:kick`, só para o host. Novo teste de integração: um jogador normal não consegue expulsar; o host não se expulsa a si próprio nem expulsa um id inexistente ou alguém já expulso; o expulso recebe `room:kicked`, fica marcado como expulso, perde a sessão e pode criar outra sala. A meio de uma ronda, expulsar o único participante que ainda não acertou termina a ronda logo.
- `npm test`: **17 testes passaram, 0 falharam**. `npm run build`: compilação de produção concluída.
- Browser, com dois separadores: o botão **Expulsar** só aparece ao host e só junto dos outros jogadores; confirmação «Expulsar Amigo da sala?»; o host vê «Expulso» na lista; o separador do jogador expulso volta ao início com o aviso, sem sessão guardada e sem o código no endereço.

A expulsão não é um banimento: o jogador pode voltar a entrar com o código, como nova entrada.

## Tema da pergunta em destaque — 29 de outubro de 2026

O tema passa a aparecer numa etiqueta grande por cima da pergunta (1,25 rem; 1,05 rem em ecrãs estreitos), com o número da pergunta e o objetivo numa linha pequena por baixo. Verificado no browser em largura de computador e de telemóvel (375 px) com uma pergunta de «Memes». `npm test`: 17 testes passaram, 0 falharam; `npm run build` concluído.

## Quem acertou a verde e respostas em português e inglês — 29 de outubro de 2026

- Classificação: durante a pergunta e a revelação da resposta, quem já acertou fica com ✓, nome e estado a verde e uma barra verde à esquerda. Verificado no browser numa sala com uma pergunta conhecida: o jogador que respondeu «lisboa» ficou com a classe `solved` e o nome na cor de sucesso; o outro manteve a cor normal.
- Respostas: revistas as 436 perguntas. 40 perguntas de texto ganharam alternativas na língua que faltava: números por extenso em inglês (`Five`, `Ten`, `Three`…), termos de Cabo Verde (`Blue Sharks`, `Creole`, `Windward`/`Leeward`, `Sal Island`…), personagens (`Master Yoda`, `Incredible Hulk`) e expressões dos memes (`Moth`, `Big Brother Brazil`, `Gato Rabugento`…). As restantes já aceitavam as duas línguas ou têm como resposta nomes próprios, iguais nas duas. Confirmado com `isCorrect`, com e sem tolerância, para exemplos em português e em inglês.
- `npm test`: 17 testes passaram, 0 falharam; `npm run build` concluído; ficheiros de `examples/` regenerados.

## Pontos: o primeiro ganha 10 e os seguintes perdem mais — 29 de outubro de 2026

Nova regra em `roundPointsFor` (`server/answers.js`): o primeiro a acertar ganha 10, tal como quem acertar até 1 s depois dele; os seguintes ganham os pontos pelo tempo menos 1 por cada jogador que já acertou, com mínimo de 1.

- Teste unitário novo com o primeiro tardio (10), o empate dentro de 1 s (10), −1 e −2 por ordem e o mínimo de 1. O teste de 6 jogadores verifica agora que o primeiro e os que acertam logo a seguir recebem 10.
- Ronda real de 20 s com 3 jogadores: 540 ms → 10 pontos; 3053 ms → 8 (9 pelo tempo − 1); 6068 ms → 5 (7 pelo tempo − 2).
- Regras dentro do jogo (português e inglês), README e CLAUDE.md atualizados.
- `npm test`: **18 testes passaram, 0 falharam**. `npm run build` concluído.

## Som ao acertar — 29 de outubro de 2026

Sons gerados com Web Audio em `client/src/sounds.js`: arpejo dó-mi-sol-dó quando o próprio jogador acerta e um «pop» curto quando outro acerta. Botão 🔊/🔇 no cabeçalho do Trigo, guardado em `localStorage`. Animação curta no «Correto!», desligada com `prefers-reduced-motion`.

- Browser, com um host por script e uma pergunta conhecida: depois de um clique real na página, o host acertou e a página criou as duas notas do «pop» (880 e 1320 Hz); a seguir o jogador acertou e criou as dez notas do arpejo (523, 659, 784 e 1047 Hz, cada uma com a oitava acima). Contagem feita a instrumentar `createOscillator`, porque o som não pode ser ouvido na verificação.
- Quem já tinha acertado ao entrar ou ao reconectar não toca som; só as novas entradas na ronda.
- `npm run build` concluído.

## Ecrã de convite — 29 de outubro de 2026

Quem chegava por link via o botão **Criar sala privada** logo a seguir ao nickname e podia criar uma sala nova por engano. Agora:

- Link `/trigo?sala=CODIGO`: ecrã próprio com o código em grande, nickname já com o cursor e um único botão principal **Entrar na sala CODIGO**; Enter entra. «Não é esta sala? Cria uma sala nova» volta ao ecrã normal.
- Sem convite: **Criar sala privada** destacado; ao escrever um código de 6 caracteres o destaque passa para **Entrar na sala**. Enter no nickname cria a sala (ou entra, se já houver código completo).
- Browser: convite para uma sala real, nickname escrito sem clicar e Enter → entrou nessa sala como jogador. Sem convite: botão principal «Criar sala privada», que passou a «Entrar na sala» com «ABC234»; Enter no nickname criou uma sala nova.
- `npm test`: 18 testes passaram, 0 falharam; `npm run build` concluído.

## Novo aspeto «Morabeza» — 29 de outubro de 2026

Escolhido entre três direções mostradas lado a lado (arcade noturno, Morabeza e pop vibrante). Fundo azul do mar em degradê, cartões claros com sombra, botões amarelo-estrela com relevo, tema da pergunta e «Fechar sala» no vermelho da bandeira, classificação em linhas arredondadas com o 1.º lugar a amarelo durante a partida e as dez estrelas no cabeçalho. Letra Baloo 2 via `@fontsource/baloo-2` 5.3.0 (OFL), empacotada pelo Vite.

- Browser, em largura de telemóvel (405 px) e de computador (1280 px): catálogo, ecrã de convite, lobby do host, editor, pergunta a decorrer, «Correto!», jogador que acertou a verde e líder marcado. Corrigida a cor das estrelas, que saía branca por causa de uma regra do cabeçalho.
- Contraste calculado: texto azul-escuro nos cartões ≈ 15:1; texto secundário nos cartões ≈ 5,6:1; azul-escuro no amarelo ≈ 11:1; branco no fundo mais claro do mar ≈ 6:1.
- `npm test`: 18 testes passaram, 0 falharam; `npm run build` concluído.

## Categorias no lobby em vez do editor de perguntas — 29 de outubro de 2026

O painel do host deixou de permitir editar, acrescentar, remover, importar ou exportar perguntas. Passou a ser **Opções da partida**: tempo, objetivo, tolerância a erros de escrita e um botão por categoria (com contagem), mais **Todas**. O servidor guarda as categorias escolhidas (`themes`), baralha só as perguntas dessas categorias (também ao recomeçar o baralho) e deixou de enviar a lista de perguntas e respostas ao host; o estado leva só `settings.themes` e `categories` (nome e contagem). Antes, o host recebia cerca de 1,2 MB em cada atualização do lobby.

- Teste de integração novo: categorias por omissão (todas), só o host escolhe, lista vazia ou categoria inexistente rejeitadas, os outros jogadores veem a escolha, e três rondas seguidas só com perguntas da categoria escolhida. Testes de configuração e de conteúdo atualizados (nenhum cliente recebe `config`).
- Browser: sala nova com as 14 categorias escolhidas; **Todas** tirou todas e mostrou «Escolhe pelo menos uma categoria» com o botão de guardar desativado; escolhidas Cabo Verde e Memes → 67 perguntas; «Guardar e iniciar partida» começou com uma pergunta de Memes.
- Regras do jogo e README corrigidos: o host já não conhece as respostas.
- `npm test`: **19 testes passaram, 0 falharam**. `npm run build` concluído.

## Fotografias-pista nas perguntas de texto — 29 de outubro de 2026

73 perguntas de texto ganharam uma fotografia que ajuda sem mostrar a resposta (o ator em vez da personagem, um animal parecido em vez do animal do meme, o estádio em vez do clube, a paisagem em vez do nome da ilha). Fluxo: pesquisa de candidatas no Wikidata/Commons só com licenças livres, folha de miniaturas revista no browser, 12 candidatas trocadas ou retiradas (letreiros com a resposta, crânios em vez de gorila, imagens minúsculas), aprovação do utilizador e descarga de versões de 500 px (máximo 225 KB; cerca de 5 MB no total) para `server/content/images/`. As imagens ficam em ficheiros, lidas por `loadBankImage` e guardadas em memória; o banco em JSON continua com cerca de 1,2 MB.

- Testes novos: 73 pistas em ficheiro, todas válidas, com crédito e fonte do Commons, sem ficheiros repetidos; nomes com caminho (`../`) rejeitados; numa ronda real a imagem dá 404 durante a contagem, é servida como `image/jpeg` com os mesmos bytes depois de a pergunta começar, e o crédito só aparece depois da resposta.
- Browser: sala com três perguntas com pista; «Que herói da DC é o alter ego de Bruce Wayne?» mostrou a fotografia de Christian Bale (500 px, carregada) e «batman» foi aceite com 10 pontos.
- `npm test`: **20 testes passaram, 0 falharam**. `npm run build` concluído. Ficheiros de `examples/` regenerados, com a contagem de fotografias por tema.

## Segunda leva de fotografias-pista — 29 de outubro de 2026

Mais 146 perguntas de texto com fotografia-pista (219 no total; 231 perguntas com imagem contando as 12 de «Quem é?»). Pistas no mesmo espírito: uma mamba-negra para o «Black Mamba», um pássaro para o Larry Bird, uma pulga para «La Pulga», o retrato de Maquiavel para «Makaveli», a CN Tower para o Drake, o quadro da capa de «Viva la Vida», um tubarão-azul para os Tubarões Azuis, o carro de cada campeão de F1 em vez do piloto, uma chávena de chá para o Cocas.

- Pesquisa agrupada (uma consulta SPARQL ao Wikidata e pedidos em lote ao Commons): 153 de 157 encontradas. Revisão das miniaturas no browser: 11 trocadas ou retiradas (um jogo de tabuleiro chamado «Tikal», outro «Niko», um cavalo chamado «Air Jordan», uma futebolista com o nome da Emma Watson, uma imagem gerada por IA, um logótipo, licenças GPL/GFDL, imagens pouco claras). Estádios e arenas cuja resposta é o clube vistos em tamanho real: nenhum mostra o nome legível.
- Descarga de 146 imagens de 500 px (ou menos), todas JPEG/PNG até 266 KB; pasta com cerca de 16 MB. Créditos acrescentados ao `IMAGENS.md` e a `server/content/question-images.json`.
- O dono do projeto decidiu que, por o jogo ser entre amigos, imagens sem licença livre são aceitáveis; registado no CLAUDE.md (marcar como «sem licença livre» no `IMAGENS.md`). Esta leva continua a ser só de imagens livres.
- `npm test`: **20 testes passaram, 0 falharam** (o teste do banco verifica as 219 pistas). `npm run build` concluído. Ficheiros de `examples/` regenerados.
