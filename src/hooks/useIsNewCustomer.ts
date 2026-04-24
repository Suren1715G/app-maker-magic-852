import { useDemoMode } from "@/contexts/DemoModeContext";

/**
 * A "new customer" is any real (non-demo) account. Real accounts should always
 * see the full app UI shells with empty data instead of the seeded mock
 * dataset — even after they've added their first location. Mock data is only
 * for demo mode (admins previewing the customer experience).
 */
export function useIsNewCustomer() {
  const { demoMode } = useDemoMode();
  return !demoMode;
}
