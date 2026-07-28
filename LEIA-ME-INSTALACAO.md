# Instalação do site

Copie para a raiz do repositório `VitEmiliano.github.io`:

```text
index.html
css/
js/
.gitattributes
```

Mantenha os arquivos que o script já criou:

```text
.nojekyll
conteudo/
├── index.json
└── sessoes/
```

A estrutura final deve ficar assim:

```text
VitEmiliano.github.io/
├── index.html
├── .nojekyll
├── .gitattributes
├── css/
│   └── estilo.css
├── js/
│   └── diario.js
└── conteudo/
    ├── index.json
    └── sessoes/
        └── Diário - AAAA-MM-DD - Título.md
```

## Teste local

Não abra `index.html` diretamente, porque o navegador pode bloquear a leitura
dos Markdown. Dentro do repositório, execute:

```powershell
python -m http.server 8000
```

Depois abra:

```text
http://localhost:8000
```

Também é possível executar `testar_site.ps1`.

## Publicação

```powershell
git add .
git commit -m "Adiciona interface do diário"
git push
```

O GitHub Pages usará `index.html` como página inicial.

## Recursos incluídos

- diário inicialmente fechado;
- sumário pesquisável;
- navegação por setas e teclado;
- animação de virar página;
- abertura direta por URL com `#id-da-sessao`;
- download do Markdown original;
- leiaute responsivo para celular;
- conversão local de Markdown sem biblioteca JavaScript externa.
