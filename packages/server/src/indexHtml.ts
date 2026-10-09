export function renderIndexHtml(
  entryPath: string,
  cssPaths: string[],
  preloadPaths: string[],
  preloadBootstrap: boolean,
): string {
  const preloads = [
    ...preloadPaths.map((href) => `    <link href="${href}" rel="modulepreload" />`),
    ...(preloadBootstrap
      ? ['    <link as="fetch" crossorigin href="/api/bootstrap" rel="preload" />']
      : []),
  ].join("\n");
  const stylesheets = cssPaths
    .map((href) => `    <link href="${href}" rel="stylesheet" />`)
    .join("\n");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link href="/public/slack-logo.svg" rel="icon" type="image/svg+xml" />
    <link href="/public/manifest.webmanifest" rel="manifest" />
    <meta content="width=device-width, initial-scale=1.0, viewport-fit=cover" name="viewport" />
    <meta content="#111318" name="theme-color" />
    <meta content="yes" name="apple-mobile-web-app-capable" />
    <meta content="black-translucent" name="apple-mobile-web-app-status-bar-style" />
    <meta content="slock" name="apple-mobile-web-app-title" />
    <title>slock</title>
${stylesheets}
${preloads}
    <script src="${entryPath}" type="module"></script>
  </head>
  <body></body>
</html>
`;
}
