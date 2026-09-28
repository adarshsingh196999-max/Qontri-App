import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        {/* ── PWA / iOS home screen metadata ──────────────────────── */}
        <meta name="theme-color" content="#1E3A5F" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Qontri" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Qontri" />

        <link rel="apple-touch-icon" href="/icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icon.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon.png" />
        <link rel="icon" type="image/png" href="/icon.png" />

        <title>Qontri</title>
        <meta
          name="description"
          content="Split expenses, settle faster, stay connected."
        />

        {/* Prevents the page from bouncing on iOS when opened standalone */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}