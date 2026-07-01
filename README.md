# `@muzza3000/md-to-html`

Small Node CLI to convert Markdown files to HTML.

## Install

```bash
npm install -g @muzza3000/md-to-html
```

## Usage

`npm` will install the executable as:

```bash
md-to-html [options] <input.md> [output.html]
```

If `output.html` is omitted, the CLI writes next to the input file using the same name with an `.html` extension.

## Options

- `-e`, `--embed-images`: embed local images as base64 data URLs. This is the default.
- `-E`, `--no-embed-images`: keep local image file paths instead of embedding them.
- `-f`, `--fragment`: output only the rendered HTML fragment.
- `-F`, `--full-document`: output a full HTML document. This is the default.
- `-s`, `--stylesheet`: add the built-in stylesheet with the SLB/Noto font stack and styled tables.
- `-h`, `--help`: show the help message.

## Examples

Convert a file to a full HTML document:

```bash
md-to-html notes.md
```

Write to a specific output file:

```bash
md-to-html notes.md dist/notes.html
```

Keep image paths instead of embedding them:

```bash
md-to-html --no-embed-images notes.md
```

Render only the HTML fragment and include the stylesheet block:

```bash
md-to-html --fragment --stylesheet notes.md snippet.html
```
