import { useSyncExternalStore } from "react";

// Nothing external ever changes, so the subscribe callback is a no-op.
const noop = () => () => {};

/**
 * Returns false while server-rendering and true once hydrated.
 *
 * Portals need document.body, which only exists in the browser. Checking
 * `typeof document` inline would render different markup on the server than the
 * client (a hydration mismatch), and the usual useEffect(() => setMounted(true))
 * trick is a synchronous setState in an effect that React's compiler lint rejects.
 * useSyncExternalStore has a dedicated server snapshot, so it expresses exactly
 * this without either problem.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noop,
    () => true, // client snapshot
    () => false, // server snapshot
  );
}
