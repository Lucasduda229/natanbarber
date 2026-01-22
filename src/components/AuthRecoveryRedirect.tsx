import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Some auth providers may redirect recovery links to the site's root (/) with tokens in the URL hash.
 * This component detects recovery tokens anywhere and forwards the user to /reset-password,
 * preserving search/hash parameters.
 */
export default function AuthRecoveryRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === "/reset-password") return;

    const searchParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));

    const typeFromSearch = searchParams.get("type");
    const typeFromHash = hashParams.get("type");

    const isRecovery =
      typeFromSearch === "recovery" ||
      typeFromHash === "recovery" ||
      // if token_hash exists, treat as recovery even if type is missing
      Boolean(searchParams.get("token_hash"));

    const hasAnyToken =
      Boolean(searchParams.get("token_hash")) || Boolean(hashParams.get("access_token"));

    if (!isRecovery || !hasAnyToken) return;

    navigate(
      {
        pathname: "/reset-password",
        search: location.search,
        hash: location.hash,
      },
      { replace: true },
    );
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}
