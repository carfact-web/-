export const authRedirectStorageKey = "carfact-auth-redirect-to";

type RedirectSource = "query.redirect" | "query.redirectTo" | "sessionStorage" | "localStorage" | "fallback";

interface ResolveAuthRedirectOptions {
  fallbackPath?: string;
  shouldClear?: boolean;
}

export interface ResolvedAuthRedirect {
  currentHref: string;
  currentSearch: string;
  localStorageRedirect: string | null;
  redirectParam: string | null;
  redirectTo: string | null;
  redirectToParam: string | null;
  resolvedRedirect: string;
  sessionStorageRedirect: string | null;
  source: RedirectSource;
}

export const normalizeAuthRedirectPath = (
  redirectTo: string | null | undefined,
  fallbackPath = "/my"
) => {
  if (!redirectTo) {
    return fallbackPath;
  }

  try {
    const url = new URL(redirectTo, window.location.origin);

    if (url.origin !== window.location.origin) {
      return fallbackPath;
    }

    return url.pathname + url.search + url.hash;
  } catch {
    return fallbackPath;
  }
};

export const saveAuthRedirect = (redirectTo: string) => {
  sessionStorage.setItem(authRedirectStorageKey, redirectTo);
  localStorage.setItem(authRedirectStorageKey, redirectTo);
};

export const clearAuthRedirect = () => {
  sessionStorage.removeItem(authRedirectStorageKey);
  localStorage.removeItem(authRedirectStorageKey);
};

export const resolveAuthRedirect = ({
  fallbackPath = "/my",
  shouldClear = false,
}: ResolveAuthRedirectOptions = {}): ResolvedAuthRedirect => {
  const searchParams = new URLSearchParams(window.location.search);
  const redirectParam = searchParams.get("redirect");
  const redirectToParam = searchParams.get("redirectTo");
  const sessionStorageRedirect = sessionStorage.getItem(authRedirectStorageKey);
  const localStorageRedirect = localStorage.getItem(authRedirectStorageKey);
  const redirectTo =
    redirectParam ??
    redirectToParam ??
    sessionStorageRedirect ??
    localStorageRedirect;
  const source: RedirectSource = redirectParam
    ? "query.redirect"
    : redirectToParam
      ? "query.redirectTo"
      : sessionStorageRedirect
        ? "sessionStorage"
        : localStorageRedirect
          ? "localStorage"
          : "fallback";
  const resolvedRedirect = normalizeAuthRedirectPath(redirectTo, fallbackPath);
  const result = {
    currentHref: window.location.href,
    currentSearch: window.location.search,
    localStorageRedirect,
    redirectParam,
    redirectTo,
    redirectToParam,
    resolvedRedirect,
    sessionStorageRedirect,
    source,
  };

  if (shouldClear) {
    clearAuthRedirect();
  }

  return result;
};
