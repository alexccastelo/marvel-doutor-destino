# Favicons nexum.iD — sites e apps

Ícones da marca v1.0 (out/2026) para sites e apps desenvolvidos pela Nexum.iD.

## Opções
| Pasta | Fundo | Símbolo |
| --- | --- | --- |
| `preto/` | Noite #0B1020 | N em Frost + módulo em Ciano Elétrico **(principal)** |
| `preto-mono/` | Noite #0B1020 | tudo em branco |
| `branco/` | branco, com contorno fino #D5DEE8 | N em Noite + módulo em Ciano Profundo |
| `branco-mono/` | branco, com contorno fino | tudo em Noite |
| `adaptativo/` | transparente | `favicon.svg` que troca de cor sozinho no tema claro/escuro do navegador |

Nos tamanhos de 16 a 48 px o traço do N é reforçado para não sumir na aba do navegador.

## Arquivos em cada pasta
- `favicon.ico` (16, 32 e 48 px) · `favicon.svg`
- `apple-touch-icon.png` 180 px: quadrado cheio, porque o iOS arredonda sozinho
- `android-chrome-192.png` · `android-chrome-512.png`
- `png/` — 16 a 512 px e `icon-maskable-512.png` (símbolo dentro da zona segura do Android)
- `site.webmanifest` com nome, ícones e cor do tema

## Como usar
Copie o conteúdo de uma pasta (ex.: `preto/`) para a raiz pública do site (`/public` no Next.js) e cole no `<head>`:

```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0B1020">
```
Com a pasta `branco/`, use `content="#FFFFFF"` no theme-color.

Para o favicon que acompanha o tema do navegador, troque a linha do SVG por `adaptativo/favicon.svg` e mantenha o `.ico` como reserva.

## Qual escolher
- **Padrão Nexum:** `preto/`. Funciona em aba clara e escura.
- **Site de cliente com identidade clara:** `branco/`.
- **Uma cor:** impressão, documentos ou quando a cor do cliente domina a página.
