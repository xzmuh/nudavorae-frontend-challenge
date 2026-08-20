# Guia do projeto

Documento de orientação: **onde está cada coisa e o que ela faz**.
Para instruções de execução e a checagem dos requisitos, veja o [README](README.md).

---

## 1. As duas partes

```
challenge/
├── api/    → servidor falso de dados (Node + TypeScript, sem framework)
└── web/    → aplicação (Angular 20, standalone + signals)
```

Rodam separados: a API na porta **4000**, o app na **4200**.
O app conversa com a API por HTTP e só por ela — não existe dado embutido no front.

---

## 2. A API (`api/src/`)

| Arquivo | O que faz |
|---|---|
| `server.ts` | **O coração.** Recebe a requisição, confere o token, aplica atraso/erro se houver regra e responde. Todas as rotas estão aqui, numeradas em comentários. |
| `data.ts` | Cria os **2.400 serviços**, 320 vendedores e as reviews quando o servidor sobe. Usa uma semente fixa, então o catálogo é sempre igual. |
| `catalog.ts` | Busca, ordenação, filtro de preço/categoria e paginação. É quem decide quais serviços entram no resultado e em que ordem. |
| `chaos.ts` | **Injeção de falhas.** Guarda as regras de "atrasa isso" / "quebra aquilo" e decide se a requisição atual bate em alguma. |
| `images.ts` | Gera a imagem (um SVG) na hora, a partir do id. Nenhuma imagem vem de fora. |
| `types.ts` | Os tipos dos dados (serviço, vendedor, review…). |
| `http.ts` | Ajudantes: responder JSON, responder erro, ler o corpo da requisição, CORS. |
| `rng.ts` | Sorteio com semente — é o que torna os dados sempre iguais a cada boot. |

**As rotas** (todas exigem o header `Authorization: Bearer svc_demo_fixed_token_2026`):

| Rota | Serve para |
|---|---|
| `GET /api/meta` | categorias, faixa de preço global e opções de ordenação |
| `GET /api/services` | a lista do catálogo (com busca, filtros e paginação) |
| `GET /api/services/:id` | os dados de um serviço + relacionados |
| `GET /api/services/:id/reviews` | as avaliações daquele serviço |
| `POST /api/services/:id/reviews` | publica uma avaliação e recalcula a média |
| `GET /api/images/:id` | a imagem privada (401 se vier sem token) |
| `/api/__chaos/rules` | liga/desliga atraso e erro (é o que o painel **Lab** usa) |

---

## 3. O app (`web/src/app/`)

Três pastas, com uma regra simples de leitura:

- **`core/`** → o miolo: quem fala com a API e quem guarda o estado. Não tem tela.
- **`shared/`** → peças visuais reutilizáveis (card, estrelas, imagem, dropdown…).
- **`features/`** → as telas em si.

### 3.1 `core/api/` — falar com a API

| Arquivo | O que faz |
|---|---|
| `api.config.ts` | Endereço da API e **o token fixo**. |
| `http.interceptors.ts` | **O interceptor.** Carimba o `Authorization` em toda requisição que sai e transforma qualquer falha num erro padronizado do app. |
| `api-error.ts` | O formato único de erro (`ApiError`): status, código, mensagem e o tipo (rede / não encontrado / servidor). É o que a tela de erro lê. |
| `catalog-api.service.ts` | Os métodos que chamam cada rota: `search()`, `detail()`, `reviews()`, `createReview()`, `image()`. |
| `chaos-api.service.ts` | Os métodos que o painel Lab usa para criar/apagar regras de falha. |
| `models.ts` | Os tipos das respostas (espelham os da API). |

### 3.2 `core/catalog/` — o estado

| Arquivo | O que faz |
|---|---|
| `catalog-filters.ts` | Traduz **URL → filtros** e **filtros → URL**. Também gera a "chave" que identifica um conjunto de resultados. |
| `catalog-store.service.ts` | **A memória da lista.** Vive enquanto o app estiver aberto: guarda os cards já carregados, os filtros, quantas páginas e a posição do scroll. É por isso que voltar não recarrega nada. |
| `service-detail-store.service.ts` | O estado de **uma** página de serviço: dados, reviews e a publicação da avaliação (com a média otimista e o desfazer). Nasce e morre junto com a tela. |

### 3.3 `core/` — o resto

| Arquivo | O que faz |
|---|---|
| `media/protected-image.service.ts` | Baixa a imagem privada via HttpClient (assinada pelo interceptor), transforma em URL local e **guarda em cache**. Libera as URLs no fim. |
| `theme/theme.service.ts` | Alterna claro/escuro e lembra a escolha. |

### 3.4 `shared/` — as peças

| Componente | O que é |
|---|---|
| `service-card/service-card.component.ts` | O card do catálogo (imagem, vendedor, título, nota, preço). |
| `service-card/service-card-skeleton.component.ts` | O "esqueleto" cinza que aparece enquanto carrega. |
| `protected-image/protected-image.component.ts` | Mostra uma imagem privada, com placeholder enquanto baixa e ícone se falhar. |
| `rating/rating-stars.component.ts` | Estrelas só de leitura (aceita nota quebrada, tipo 4,3). |
| `rating/rating-input.component.ts` | **O seletor de nota**, operável por teclado (Tab estrela a estrela, Espaço/Enter escolhe, setas também). |
| `select-menu/select-menu.component.ts` | **O dropdown próprio** (usado na ordenação). Sem `<select>`, sem biblioteca. |
| `states/empty-state.component.ts` | A tela de "não tem nada aqui". |
| `states/error-state.component.ts` | A tela de erro, com botão de tentar de novo. |

### 3.5 `features/` — as telas

| Arquivo | O que faz |
|---|---|
| `catalog/catalog-page.component.ts` | **Tela 1.** Lê a URL, manda o store buscar, escolhe qual dos 4 estados mostrar, restaura o scroll e dispara a paginação infinita. |
| `catalog/catalog-page.component.html` / `.css` | O visual dessa tela. Os 4 estados estão no `@switch` do HTML. |
| `catalog/catalog-filters-bar.component.ts` | A barra: busca, dropdown de ordenação, botão **Filters** (que abre preço + categorias) e os chips do que está ativo. |
| `service-detail/service-detail-page.component.ts` | **Tela 2.** Carrega o serviço, monta a galeria, cuida do formulário de avaliação. |
| `service-detail/service-detail-page.component.html` / `.css` | O visual: imagem, descrição, reviews e a coluna de preço/vendedor. |
| `lab/chaos-panel.component.ts` | O painel **Lab** do topo: liga atraso e erro na API com um clique. É a ferramenta de teste. |

### 3.6 Raiz do app

| Arquivo | O que faz |
|---|---|
| `app.ts` / `app.html` / `app.css` | O cabeçalho, o rodapé e o lugar onde as telas entram. |
| `app.routes.ts` | `/` → catálogo, `/services/:id` → detalhe. |
| `app.config.ts` | Liga tudo: rotas, HttpClient e os interceptors. |
| `styles/tokens.css` | **O design system**: cores (claro e escuro), fontes, tamanhos, espaçamentos, raios, sombras. |
| `styles.css` | Reset + as peças básicas (`.btn`, `.input`, `.chip`, `.card`, `.skeleton`). |

---

## 4. "Quero mexer em X, vou onde?"

| Quero… | Arquivo |
|---|---|
| Trocar cor, fonte, espaçamento, raio | `web/src/styles/tokens.css` |
| Mudar a aparência de botão/input/chip | `web/src/styles.css` |
| Mudar o card do catálogo | `shared/service-card/service-card.component.ts` |
| Mexer na barra de busca/filtros | `features/catalog/catalog-filters-bar.component.ts` |
| Mudar o layout da página de serviço | `features/service-detail/service-detail-page.component.html` e `.css` |
| Mudar textos dos estados vazio/erro | nos HTMLs das telas (é lá que os textos são passados) |
| Trocar o token | `core/api/api.config.ts` **e** `api/src/server.ts` |
| Mudar quantos cards por página | `PAGE_SIZE` em `core/api/catalog-api.service.ts` |
| Mudar como a busca ranqueia | `api/src/catalog.ts`, função `relevanceScore` |
| Mudar a quantidade de serviços | `SERVICE_COUNT` em `api/src/data.ts` |
| Adicionar um cenário de teste no Lab | lista `PRESETS` em `features/lab/chaos-panel.component.ts` |

---

## 5. Como as partes difíceis funcionam

### A busca antiga não pode ganhar da nova
`core/catalog/catalog-store.service.ts`

Toda busca entra numa fila e passa por `switchMap` (linha ~84): quando chega uma
busca nova, a anterior é **cancelada de verdade** (a requisição é abortada).
Além disso, cada pedido leva um número (`latestToken`, linha ~52) e, na hora de
aplicar o resultado, se o número não for o mais recente o resultado é jogado
fora (linha ~170). São duas travas independentes, nenhuma usa timer.

### Voltar não recarrega a lista
`catalog-store.service.ts` + `features/catalog/catalog-page.component.ts`

O store é único no app inteiro. Ao voltar, a tela pede "carregue esses filtros",
o store vê que **são os mesmos de antes e que já tem itens** e simplesmente não
faz nada (linha ~106) — sem spinner e sem requisição. A posição do scroll é
guardada quando a navegação começa (`NavigationStart`, linha ~129 da tela) e
reposta no primeiro desenho (`afterNextRender`, linha ~118).

> Por que no início da navegação e não na saída da tela? Porque o Angular tira a
> lista do DOM antes de rodar o "adeus" do componente, e nesse momento o
> navegador já jogou o scroll para o topo. Isso está comentado no código.

### Recarregar (F5) devolve a mesma tela
Os filtros vivem na URL (`?q=&sort=&minPrice=&maxPrice=&category=`) e a
quantidade de páginas carregadas também (`&pages=3`). Ao abrir, a tela lê tudo
isso e o store refaz as 3 páginas **numa requisição só**.

### A média muda na hora e volta se falhar
`core/catalog/service-detail-store.service.ts`, método `submitReview` (linha ~142)

1. Tira uma "foto" do estado atual (média, contagem, lista de reviews).
2. Já aplica a nota nova na tela — a média e a contagem mudam antes da resposta.
3. Deu certo: substitui pelos números que o servidor devolveu.
4. Deu erro: **restaura a foto** e mostra o aviso (linha ~192).

### As imagens são privadas
`core/media/protected-image.service.ts`

`<img src="...">` não consegue mandar header, então a imagem é baixada por
código (com o token, via interceptor), vira uma URL local e fica em cache — por
isso voltar para a lista não baixa nada de novo. As URLs são liberadas no fim.

---

## 6. Como testar cada requisito (pelo navegador)

O botão **Lab**, no topo, controla a API. Roteiro:

| Quero ver | O que fazer |
|---|---|
| **Carregando** | Lab → "Delay every catalog request by 2s" e recarregue |
| **Erro** | Lab → "Fail the catalog list once (500)" e recarregue |
| **Vazio** | busque por `zzzqqq` |
| **Busca antiga perdendo** | Lab → "Delay searches starting with «sor» by 3s". Digite `sor`, espere um pouco, complete para `sorvete` |
| **Voltar restaurando** | role bastante, abra um card, volte |
| **Nota por teclado** | na página do serviço, use Tab até as estrelas, Espaço para escolher |
| **Rollback da média** | Lab → "Fail publishing a review (500)", escolha estrelas e publique |
| **Claro/escuro** | botão de sol/lua no topo |

---

## 7. Vocabulário rápido (Angular)

- **signal** — uma caixinha com um valor que avisa a tela quando muda. Lê-se
  chamando: `items()`.
- **computed** — um valor derivado de outros signals; recalcula sozinho.
- **effect** — um pedaço de código que roda quando algo que ele lê muda.
- **store** — uma classe que guarda estado e é compartilhada pelas telas
  (aqui: `CatalogStore` e `ServiceDetailStore`).
- **interceptor** — um filtro por onde passa toda requisição HTTP; é onde o
  token é carimbado.
- **standalone component** — componente que declara sozinho o que usa, sem
  `NgModule`.
