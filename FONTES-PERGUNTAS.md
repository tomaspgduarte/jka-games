# Banco de perguntas JKA games

252 perguntas em inglês: **240 de texto + 12 com fotografia**. Os oito temas também são apresentados em inglês. Mantêm-se os nomes próprios e títulos originais, com respostas em inglês e alternativas portuguesas já aceites. As perguntas e pistas foram escritas para este projeto; não foram copiadas de listas de quizzes. Preferem-se factos históricos, nomes de personagens, alcunhas e músicas identificadas por título. Não foram incluídas letras de músicas.

| Tema | Perguntas | Com fotografia |
| --- | ---: | ---: |
| VALORANT | 33 | 3 |
| Counter-Strike | 30 | 0 |
| F1 | 32 | 2 |
| Basketball | 32 | 2 |
| Football | 32 | 2 |
| Hip-hop / Rap | 33 | 3 |
| Songs | 30 | 0 |
| Characters | 30 | 0 |

## Referências e verificação

Foram usadas as referências abaixo para conferir identidades, marcos históricos e pontos de dúvida. A revisão combinou conhecimento geral, páginas oficiais e catálogos dos próprios artistas; não representa uma investigação individual exaustiva de cada pergunta.

- VALORANT: [agentes oficiais da Riot](https://playvalorant.com/en-us/agents/), [perfil de aspas](https://www.vlr.gg/player/8480/aspas), [TenZ](https://www.vlr.gg/player/9/tenz), [Sacy](https://www.vlr.gg/player/659/sacy), [Champions 2022](https://liquipedia.net/valorant/VCT/2022/Champions/Player_Information).
- Counter-Strike: [Counter-Strike 2](https://www.counter-strike.net/cs2), [perfil e histórico de s1mple no HLTV](https://www.hltv.org/player/7998/s1mple).
- F1: [Hall of Fame oficial](https://www.formula1.com/en/drivers/hall-of-fame), [Ayrton Senna](https://www.formula1.com/en/information/drivers-hall-of-fame-ayrton-senna.FLD7ZtO0nUn7JzLEn5rOJ), [Hall of Fame da FIA](https://halloffame.fia.com/).
- Basquetebol: [Michael Jordan — NBA](https://api-hub.nba.com/news/history-nba-legend-michael-jordan), [Kareem Abdul-Jabbar — Hall of Fame](https://www.hoophall.com/hall-of-famers/kareem-abdul-jabbar).
- Futebol: [final do Mundial 2022 — FIFA](https://www.fifa.com/es/articles/argentina-le-gano-por-penales-a-francia-y-se-consagro-campeon-del-mundo). As conquistas são identificadas pelo ano para não dependerem da classificação atual.
- Rap português: [Reflexo — canal oficial de Dillaz](https://www.youtube.com/watch?v=WQx_Y4etI-g), [You Are Forgiven — Slow J no Spotify](https://open.spotify.com/album/4aYjRWiuEU8gGeIs3FeAWJ), [Plutónio — representação artística](https://www.ricardoagency.pt/plutonio-2/), [Cor D'Água — catálogo do disco](https://www.wook.pt/musica/cor-dagua-cd-toy-toy-t-rex/29654731), [NGA — discografia](https://hiphopportugal.pt/artista/nga/albuns/).
- Músicas: [Casa — site oficial de Carolina Deslandes](https://carolinadeslandes.com/lancamentos/casa), [A Vida Toda — canal oficial](https://www.youtube.com/watch?v=XoWAncMsIaA). Os restantes títulos escolhidos são lançamentos conhecidos e estáveis, com identificação da banda ou do intérprete principal.
- Personagens: pistas de obras conhecidas, usando nomes próprios e aceitando as variantes portuguesas/brasileiras mais comuns.

## Fotografias

Pessoas incluídas: aspas, TenZ, Sacy, Lewis Hamilton, Max Verstappen, Cristiano Ronaldo, Lionel Messi, LeBron James, Stephen Curry, Eminem, Snoop Dogg e Kendrick Lamar. Os ficheiros são fotografias reais, não retratos gerados. Fontes, autores e licenças estão em [IMAGENS.md](IMAGENS.md) e são preservados na exportação JSON. Os créditos aparecem depois da revelação da resposta.

## Ficheiros

- `examples/banco-completo.json`: todos os temas, pronto a importar.
- `examples/temas/`: oito ficheiros independentes, um por tema.
- `examples/resumo-banco.json`: contagens por tema.
- `server/content/text-questions.js`: perguntas de texto editáveis no projeto.
- `server/content/photo-questions.json`: fotografias embutidas e respetivos créditos.

O banco completo é o ponto de partida de cada nova sala. O host continua a poder editar, remover ou acrescentar perguntas. As salas já criadas antes de uma alteração ao banco não mudam automaticamente; importa o banco ou cria uma nova sala.
