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
├── sessoes/
└── missoes/
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
    ├── sessoes/
    │   └── Diário - AAAA-MM-DD - Título.md
    └── missoes/
        └── Nome da missão.md
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

Na pasta que contém o repositório, execute:

```powershell
python publicar_site_github.py
```

O script sincroniza o conteúdo, valida o site, mostra todas as alterações e
pede confirmação antes de criar o commit e enviá-lo ao GitHub. Para atualizar
somente os arquivos em `conteudo/`, sem commit ou envio, execute
`python sincronizar_conteudo.py`.

O GitHub Pages usará `index.html` como página inicial.

## Recursos incluídos

- página inicial com acesso às missões e ao diário;
- missões agrupadas por acesso e exibidas em formato de papiro;
- diário inicialmente fechado;
- sumário pesquisável;
- navegação por setas e teclado;
- animação de virar página;
- abertura direta por URL para sessões e missões;
- download do Markdown original;
- leiaute responsivo para celular;
- conversão local de Markdown sem biblioteca JavaScript externa.
