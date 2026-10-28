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
