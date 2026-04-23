import { useDemoMode } from "@/contexts/DemoModeContext";
import { useLocationCtx } from "@/contexts/LocationContext";

/**
 * A "new customer" is a real (non-demo) account that hasn't set anything up
 * yet — represented today by having zero saved locations. They should see the
 * full app UI shells with empty data instead of the seeded mock dataset.
 */
export function useIsNewCustomer() {
  const { demoMode } = useDemoMode();
  const { list } = useLocationCtx();
  return !demoMode && list.length === 0;
}
