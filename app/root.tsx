import { useEffect, type ReactNode, useReducer } from "react";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useLocation,
  useRouteError
} from "@remix-run/react";
import { getPostMetaData } from "./utils/server/aws.server";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { StopFOUC, type Theme, ThemeProvider, useTheme } from "./utils/providers/ThemeProvider";
import { SidebarProvider, useSidebar } from "./utils/providers/SidebarProvider";

import tailwind from "./tailwind.css";
import fonts from "./styles/fonts.css";
import docs from "./styles/docs.css";

import { GetTheme } from "./session.server";
import type { FrontMatterTypings } from "./types/mdx";
import RootReducer from "./rootReducer";
import { RootContext } from "./utils/providers/RootProvider";

import type { LinksFunction, MetaFunction, LoaderArgs } from "@remix-run/node";
import type { V2_ErrorBoundaryComponent } from "@remix-run/react/dist/routeModules";
import slugify from "@sindresorhus/slugify";
import { cssBundleHref } from "@remix-run/css-bundle";

export type PrevOrNextLink = FrontMatterTypings | null;

export type UpdateLinks = { prev: PrevOrNextLink; next: PrevOrNextLink };

export type RootOutletContext = UpdateLinks;

export const links: LinksFunction = () => {
  return [
    { rel: "stylesheet", href: tailwind },
    { rel: "stylesheet", href: docs },
    { rel: "stylesheet", href: fonts },
    ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
  ];
};

export const loader = async ({ request }: LoaderArgs) => {
  const meta_nullable = await getPostMetaData();
  const theme = await GetTheme(request);

  // can add session theme data here if we want to store that. Otherwise, just using the regular script tag in the document works.
  if (meta_nullable) {
    const meta = meta_nullable;

    return typedjson(
      { meta, theme },
      {
        headers: {
          "Cache-Control": "public, max-age=84600",
        }
      }
    );
  }

  // throw error? How necessary is meta? Seems pretty necessary.
  // Depending on how much we need meta, we can just return null and handle it where meta would go.
  throw new Error("Uh oh! Something went wrong!");
};

export const meta: MetaFunction = () => {
  return {
    charset: "utf-8",
    title: "Remix PWA Docs",
    viewport: "width=device-width,initial-scale=1",
    keywords: "Remix,ShafSpecs,Remix PWA,Remix PWA Docs,Remix PWA Documentation,Remix PWA Documentation,remix-pwa,remix-pwa-docs,@remix-pwa,v3",
    "twitter:card": "summary_large_image",
    "twitter:creator": "@ShafSpecs",
    "twitter:title": "Remix PWA Docs",
    "twitter:image": "https://ucarecdn.com/43135828-6822-4549-a0b7-23219e7353d1/-/preview/1200x630/-/quality/smart_retina/-/format/auto/",
    "og:title": "Remix PWA Docs",
    "og:type": "website",
    "og:url": "https://remix-pwa.run",
    "twitter:description": "The home of Remix PWA. Enhance your Remix application with PWA functionalities like never before.",
    "og:locale": "en_US",
    "og:image": "https://ucarecdn.com/43135828-6822-4549-a0b7-23219e7353d1/-/preview/1200x630/-/quality/smart_retina/-/format/auto/",
    "og:image:url": "https://ucarecdn.com/43135828-6822-4549-a0b7-23219e7353d1/-/preview/1200x630/-/quality/smart_retina/-/format/auto/",
    "og:image:secure_url": "https://ucarecdn.com/43135828-6822-4549-a0b7-23219e7353d1/-/preview/1200x630/-/quality/smart_retina/-/format/auto/",
    "og:image:alt": "Remix PWA Documentation",
    "og:image:width": "1200",
    "og:image:height": "630",
    "og:image:type": "image/png",
    "og:description": "The home of Remix PWA. Enhance your Remix application with PWA functionalities like never before.",
  }
};

/**
 * @description Separate out main styles and desired components from the App component so that we have a baseline for any errors that happen.
 *
 * @param children - The children of the document
 * @param ssr_theme - The theme that is set on the server
 *
 * @returns The main styles and components of the app
 */
const MainDocument = ({ children, ssr_theme }: { children: ReactNode; ssr_theme: Theme | null }) => {
  const [theme] = useTheme();
  const [closed] = useSidebar();

  return (
    <html lang="en" className={`antialiased ${theme || ""}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
        <link rel="mask-icon" href="/icons/safari-pinned-tab.svg" color="#2b5797" />
        <meta name="msapplication-TileColor" content="#2b5797" />
        <meta name="theme-color" content="#ffffff" />
        <Links />
        <StopFOUC ssr_theme={ssr_theme !== null} />
      </head>
      <body
        className={`${!closed && "overflow-hidden"
          } bg-white transition-colors scroll-smooth antialiased duration-300 dark:bg-slate-900`}
      >
        {children}
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
};

/**
 * @description Wrap the main document in the theme provider so that we can use the theme context on the html element.
 *
 * @param ssr_theme - The theme that is set on the server
 * @param children - The children of the document
 *
 * @returns
 */
const MainDocumentWithProviders = ({ ssr_theme, children }: { ssr_theme: Theme | null; children: ReactNode }) => {
  return (
    <ThemeProvider ssr_theme={ssr_theme}>
      <SidebarProvider>
        <MainDocument ssr_theme={ssr_theme}>{children}</MainDocument>
      </SidebarProvider>
    </ThemeProvider>
  );
};

export default function App() {
  const { meta, theme } = useTypedLoaderData<typeof loader>();
  let location = useLocation();

  const [state, dispatch] = useReducer(RootReducer, { prev: null, next: null });

  const getPreviousAndNextRoute = (): UpdateLinks => {
    const currentRoute = location.pathname;

    let routes: FrontMatterTypings[] = [];
    routes = meta
      .map((route) => {
        return route.children;
      })
      .flat();

    const currentRouteIndex = routes.findIndex((route) => `/docs/${slugify(route.shortTitle)}` === currentRoute);

    let nextRoute: PrevOrNextLink = null;
    let prevRoute: PrevOrNextLink = null;

    if (currentRouteIndex < routes.length - 1) {
      nextRoute = routes[currentRouteIndex + 1];
    }

    if (currentRouteIndex > 0) {
      prevRoute = routes[currentRouteIndex - 1];
    }

    return { prev: prevRoute, next: nextRoute };
  };

  useEffect(() => {
    const { prev, next } = getPreviousAndNextRoute();
    dispatch({ type: "updateLinks", payload: { prev, next } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  return (
    <MainDocumentWithProviders ssr_theme={theme}>
      <RootContext.Provider value={{ state, dispatch }}>
        <Outlet />
      </RootContext.Provider>
    </MainDocumentWithProviders>
  );
}

export const ErrorBoundary: V2_ErrorBoundaryComponent = () => {
  const error = useRouteError();
  let message: string | number = "";
  let stack: undefined | string = "";
  if (error instanceof Error) {
    message = error.message;
    stack = error.stack;
  }
  if (isRouteErrorResponse(error)) {
    message = error.status;
    stack = error.statusText;
  }
  return (
    <MainDocumentWithProviders ssr_theme={null}>
      <h1>Status: {message}</h1>
      <h2>StatusText: {stack}</h2>
    </MainDocumentWithProviders>
  );
};
