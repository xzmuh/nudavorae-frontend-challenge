# Servio — catálogo de serviços

Duas telas (**catálogo** e **detalhe do serviço**), cada uma com os quatro estados
(padrão, carregando, vazio e erro), servidas por uma API mock em Node/TypeScript
com 2.400 serviços semeados.

> Procurando onde fica cada coisa? Veja o **[GUIA.md](GUIA.md)** — mapa do
> projeto, o que cada arquivo faz e onde mexer para mudar cada coisa.

- `web/` — Angular 20 (standalone + signals), CSS próprio com design tokens.
- `api/` — servidor HTTP em Node + TypeScript, sem framework.

Sem biblioteca de componentes, sem framework CSS utilitário, sem CDN: fontes,
ícones e imagens vêm do próprio projeto.

---

## Como rodar

```bash
npm run setup      # instala api/ e web/

# terminal 1
npm run api        # http://localhost:4000

# terminal 2
npm run web        # http://localhost:4200
```

`npm run typecheck` roda o TypeScript dos dois projetos.

---

## API (`api/`)

Servidor HTTP puro, dados gerados por PRNG determinístico (mesma semente →
mesmo catálogo a cada boot). **2.400 serviços**, 320 vendedores e reviews.

| # | Rota | Descrição |
|---|------|-----------|
| 1 | `GET /api/meta` | categorias com contagem, faixa de preço global, ordenações |
| 2 | `GET /api/services` | busca + ordenação + faixa de preço + categorias + paginação |
| 3 | `GET /api/services/:id` | detalhe + serviços relacionados |
| 4 | `GET /api/services/:id/reviews` | reviews paginadas |
| 5 | `POST /api/services/:id/reviews` | publica review e recalcula a média |
| 6 | `GET /api/images/:imageId` | **mídia privada** (SVG gerado, exige `Authorization`) |

Auxiliares: `GET /api/health` (público) e `/api/__chaos/rules` (controle de falhas).

Todas as rotas exigem `Authorization: Bearer svc_demo_fixed_token_2026` — o
mesmo token fixo que o interceptor do front injeta.

### Atraso e erro em uma resposta específica

Dois mecanismos:

1. **Por requisição** — `?_delay=2000` e/ou `?_status=500` (ou os headers
   `x-chaos-delay` / `x-chaos-status`) afetam só aquela chamada.
2. **Por regra** — `POST /api/__chaos/rules` casa método + trecho do path +
   valores de query, então dá para atingir **uma resposta específica**:

```bash
# deixa apenas a busca por "sor" 3s mais lenta
curl -X POST http://localhost:4000/api/__chaos/rules \
  -H "Authorization: Bearer svc_demo_fixed_token_2026" \
  -H "content-type: application/json" \
  -d '{"label":"slow sor","pathContains":"/api/services","queryMatch":{"q":"sor"},"delayMs":3000}'
```

`GET` lista, `DELETE /api/__chaos/rules/:id` remove, `DELETE /api/__chaos/rules`
limpa tudo. `times` limita a regra a N respostas; `matchMode` aceita
`equals` (padrão), `contains` e `startsWith`.

O painel **Lab**, no header da aplicação, aplica esses presets com um clique —
não é preciso usar curl para testar nenhum dos cenários.

---

## Como verificar cada requisito

### Estado na URL
Busca, ordenação, faixa de preço, categorias **e a profundidade da paginação**
vivem em `?q=&sort=&minPrice=&maxPrice=&category=&pages=`. A URL é a **única
fonte de verdade**: o componente lê `queryParamMap` e qualquer mudança navega
com `replaceUrl`. Como `pages` também está lá, recarregar com 72 cards na tela
devolve os mesmos 72 cards (uma requisição só, não N), não a primeira página.

### Resposta antiga nunca sobrescreve a mais nova
Abra o Lab → “Delay searches starting with «sor» by 3s”. Digite `sor`, espere um
instante e complete para `sorvete`. O resultado de `sor` nunca aparece.

Duas garantias, ambas sem timer:

- as requisições passam por `switchMap` (`CatalogStore`), que cancela — de fato
  aborta — a chamada anterior;
- todo resultado carrega o *token* da requisição que o originou e é descartado se
  esse token não for o mais recente.

### Imagens privadas
`<img>` não envia headers, então as imagens são baixadas via `HttpClient`
(passando pelo interceptor com o token), viram `objectURL` e ficam em cache no
`ProtectedImageService` — voltar para a lista não rebaixa nenhuma imagem.

### Avaliação pelo teclado
Cada estrela é uma parada de Tab: **Tab / Shift+Tab** andam estrela a estrela,
**Espaço ou Enter** selecionam a que está em foco (ativação nativa de `<button>`).
As setas ←/→/↑/↓ movem e já selecionam, **Home/End** vão para 1 e 5 e as teclas
`1`–`5` selecionam direto. A estrela em foco aparece em preview ("Space to
 select") antes de virar escolha, o foco é sempre visível e o valor escolhido é
anunciado por uma região `role="status"`. Dá para avaliar e publicar sem tocar
no mouse: Tab até a estrela → Espaço → Tab → Tab → Enter.

### Média otimista com rollback
Ao publicar, média e contagem mudam na hora (e também no card já em cache da
lista). Lab → “Fail publishing a review (500)”: a média volta exatamente ao valor
anterior e o aviso de erro explica o que aconteceu.

### Voltar restaura a lista
`CatalogStore` é singleton: guarda itens paginados, filtros e offset de scroll.
Ao voltar, `load()` percebe que os filtros são os mesmos e **não busca nada** —
sem spinner, sem refetch — e o scroll é restaurado em `afterNextRender`.
(`withInMemoryScrolling({ scrollPositionRestoration: 'disabled' })` +
`history.scrollRestoration = 'manual'` garantem que ninguém mais mexa no scroll.)

### Claro e escuro
Toggle no header; o tema é aplicado no `<html data-theme>` antes da primeira
pintura (script inline no `index.html`), então não há flash. Ambos os modos usam
os mesmos tokens.

### Fontes locais
`@fontsource-variable/inter` e `@fontsource-variable/plus-jakarta-sans` são
dependências do projeto — os `.woff2` saem no bundle (`dist/web/browser/media/`).
Nenhuma requisição sai para fora de `localhost`.

---

## Interface

- **Dropdown próprio** (`app-select-menu`): padrão combobox + listbox, sem
  `<select>` e sem biblioteca. Enter/Espaço/setas abrem, setas e Home/End
  navegam, Enter escolhe, Esc fecha e devolve o foco ao gatilho. Gatilho e
  opções são `<button>` de verdade.
- **Filtros recolhíveis**: a barra fica com busca + ordenação + botão
  “Filters” (com contador). Preço e categorias ficam no painel; o que está
  ativo aparece como chip removível, então nada fica escondido do usuário.
- **Responsivo**: verificado em 390px, 768px e 1440px sem scroll horizontal.
  No detalhe, a tira de miniaturas rola sozinha e a coluna lateral vira bloco.

---

## Design system

`web/src/styles/tokens.css` concentra cores (claro/escuro), tipografia, escala de
espaçamento (4 → 80), raios, sombras, durações e z-index. Nenhum componente
escreve um valor cru: quando chegar a tabela final do desafio, só esse arquivo
muda. `web/src/styles.css` traz as primitivas (`.btn`, `.input`, `.select`,
`.chip`, `.card`, `.skeleton`) e o reset.

---

## Critérios eliminatórios

- **Zero `any` e zero `@ts-ignore`/`@ts-expect-error`** no repositório. O front
  roda com `strict` + `noUnusedLocals` + `noUnusedParameters` +
  `noUncheckedIndexedAccess` e `strictTemplates`; a API acrescenta
  `exactOptionalPropertyTypes`. Payloads externos entram como `unknown` e são
  estreitados por type guards.
- **Nenhum `setTimeout` no front-end.** A condição de corrida é resolvida por
  `switchMap` + token de requisição. O único timer do projeto está na API
  (`node:timers/promises`) e é o próprio atraso artificial pedido no enunciado.

```bash
grep -rn "setTimeout" web/src        # nada
grep -rnE ":\s*any\b|as any|@ts-ignore" api/src web/src   # nada
```

---

## Fora de escopo (conforme o enunciado)

Sem autenticação (token fixo no interceptor), upload, checkout, chat, dashboard
do criador, novo design system, SSR ou camada de i18n. Os botões “Buy”,
“Message seller” e “Sign in” são apenas superfície visual.
