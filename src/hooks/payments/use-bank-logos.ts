import { resolveBankLogo } from '../../lib/payments/bank-logo';
import { bankLogoAssets } from '../../lib/payments/bank-logo-assets';

export function useBankLogos() {
  return {
    getBankLogo(code: string | number | null | undefined, name?: string): number | null {
      const file = resolveBankLogo(code, name);
      return file ? bankLogoAssets[file] ?? null : null;
    },
    isLoaded: true,
  };
}
