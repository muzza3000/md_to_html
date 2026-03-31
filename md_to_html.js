#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');
const { version } = require('./package.json');

const MIME_TYPES = {
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const DEFAULT_STYLESHEET = `body {
  font-family: "SLB Sans Light", "Noto Sans Regular", "Noto Sans CJK SC Regular", sans-serif;
  font-weight: 400;
  line-height: 1.5;
}

pre {
  background: #f5f7f8;
  border: 1px solid #d9e1e4;
  border-radius: 6px;
  overflow-x: auto;
  padding: 12px 16px;
}

code {
  background: #f5f7f8;
  border-radius: 4px;
  font-family: "Courier New", monospace;
  padding: 0.1em 0.3em;
}

pre code {
  background: transparent;
  padding: 0;
}

blockquote,
.note,
.warning,
.tip,
.important {
  background: #f7f9fb;
  border-left: 4px solid #2563eb;
  border-radius: 4px;
  margin: 16px 0;
  padding: 12px 16px;
}

blockquote > :first-child,
.note > :first-child,
.warning > :first-child,
.tip > :first-child,
.important > :first-child {
  margin-top: 0;
}

blockquote > :last-child,
.note > :last-child,
.warning > :last-child,
.tip > :last-child,
.important > :last-child {
  margin-bottom: 0;
}
`;

function isLocalImageSource(source) {
  return !/^(?:[a-z]+:)?\/\//i.test(source) && !source.startsWith('data:');
}

function createFigureId(source) {
  const normalized = source
    .replace(/^[./]+/, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return `figure-${normalized}`;
}

function buildImageIdMap(markdown) {
  const imagePattern = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const imageIdMap = new Map();
  let match;

  while ((match = imagePattern.exec(markdown)) !== null) {
    const source = match[1];

    if (!isLocalImageSource(source) || imageIdMap.has(source)) {
      continue;
    }

    imageIdMap.set(source, createFigureId(source));
  }

  return imageIdMap;
}

function rewriteFigureLinks(html, imageIdMap) {
  return html.replace(/(<a\b[^>]*\bhref=")([^"]+)(")/gi, (fullMatch, prefix, href, suffix) => {
    const figureId = imageIdMap.get(href);
    return figureId ? `${prefix}#${figureId}${suffix}` : fullMatch;
  });
}

function addFigureIdsToImages(html, imageIdMap) {
  return html.replace(/<img\b([^>]*?)\bsrc="([^"]+)"([^>]*)>/gi, (fullMatch, beforeSrc, src, afterSrc) => {
    const figureId = imageIdMap.get(src);

    if (!figureId || /\bid="/i.test(fullMatch)) {
      return fullMatch;
    }

    return `<img id="${figureId}"${beforeSrc}src="${src}"${afterSrc}>`;
  });
}

function addImageSizing(html) {
  return html.replace(/<img\b([^>]*?)>/gi, (fullMatch, attributes) => {
    if (/\bstyle="/i.test(fullMatch)) {
      return fullMatch.replace(
        /\bstyle="([^"]*)"/i,
        (styleMatch, styleValue) =>
          `style="${styleValue.trim().replace(/;?\s*$/, ';')} max-width: 100%; height: auto;"`
      );
    }

    return `<img${attributes} style="max-width: 100%; height: auto;">`;
  });
}

async function embedLocalImages(html, markdownPath) {
  const imagePattern = /(<img\b[^>]*\bsrc=")([^"]+)(")/gi;
  const matches = [...html.matchAll(imagePattern)];

  if (matches.length === 0) {
    return html;
  }

  let embeddedHtml = html;

  for (const match of matches) {
    const [fullMatch, prefix, src, suffix] = match;

    if (!isLocalImageSource(src)) {
      continue;
    }

    const imagePath = path.resolve(path.dirname(markdownPath), src);
    const extension = path.extname(imagePath).toLowerCase();
    const mimeType = MIME_TYPES[extension];

    if (!mimeType) {
      continue;
    }

    const imageBuffer = await fs.readFile(imagePath);
    const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
    embeddedHtml = embeddedHtml.replace(
      fullMatch,
      `${prefix}${dataUrl}${suffix}`
    );
  }

  return embeddedHtml;
}

function getHelpText() {
  return `md-to-html

Convert a Markdown file to HTML.

Usage:
  md-to-html [options] <input.md> [output.html]

Options:
  -e, --embed-images      Embed local images as base64 data URLs (default)
  -E, --no-embed-images   Keep local image file paths
  -f, --fragment          Output only the rendered HTML fragment
  -F, --full-document     Output a full HTML document (default)
  -s, --stylesheet        Add the default stylesheet with the SLB/Noto font stack
  -v, --version           Show the CLI version
  -h, --help              Show this help message
`;
}

function parseArgs(argv) {
  let embedImages = true;
  let fullDocument = true;
  let addStylesheet = false;
  let showHelp = false;
  let showVersion = false;
  const positionalArgs = [];

  for (const arg of argv) {
    if (arg === '-e' || arg === '--embed-images') {
      embedImages = true;
      continue;
    }

    if (arg === '-E' || arg === '--no-embed-images') {
      embedImages = false;
      continue;
    }

    if (arg === '-F' || arg === '--full-document') {
      fullDocument = true;
      continue;
    }

    if (arg === '-f' || arg === '--fragment') {
      fullDocument = false;
      continue;
    }

    if (arg === '-s' || arg === '--stylesheet') {
      addStylesheet = true;
      continue;
    }

    if (arg === '-h' || arg === '--help') {
      showHelp = true;
      continue;
    }

    if (arg === '-v' || arg === '--version') {
      showVersion = true;
      continue;
    }

    positionalArgs.push(arg);
  }

  return {
    embedImages,
    fullDocument,
    addStylesheet,
    showHelp,
    showVersion,
    positionalArgs,
  };
}

async function main() {
  const { embedImages, fullDocument, addStylesheet, showHelp, showVersion, positionalArgs } = parseArgs(process.argv.slice(2));
  const [inputArg, outputArg] = positionalArgs;

  if (showHelp) {
    console.log(getHelpText());
    process.exit(0);
  }

  if (showVersion) {
    console.log(version);
    process.exit(0);
  }

  if (!inputArg) {
    console.error(getHelpText());
    process.exit(1);
  }

  const inputPath = path.resolve(inputArg);
  const outputPath = path.resolve(
    outputArg || inputPath.replace(/\.md$/i, '.html')
  );

  const { marked } = await import('marked');
  const markdown = await fs.readFile(inputPath, 'utf8');
  const imageIdMap = buildImageIdMap(markdown);
  let htmlBody = marked.parse(markdown);
  htmlBody = rewriteFigureLinks(htmlBody, imageIdMap);
  htmlBody = addFigureIdsToImages(htmlBody, imageIdMap);
  htmlBody = addImageSizing(htmlBody);

  if (embedImages) {
    htmlBody = await embedLocalImages(htmlBody, inputPath);
  }

  const stylesheetBlock = addStylesheet ? `<style>
${DEFAULT_STYLESHEET}</style>
` : '';
  const htmlOutput = fullDocument ? `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${path.basename(inputPath, path.extname(inputPath))}</title>
    ${stylesheetBlock}
  </head>
  <body>
${htmlBody}
  </body>
</html>
` : `${stylesheetBlock}${htmlBody}
`;

  await fs.writeFile(outputPath, htmlOutput, 'utf8');
  console.log(`Converted ${inputPath} -> ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
