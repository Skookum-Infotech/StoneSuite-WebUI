import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/useAuthStore';
import { companyProfileService } from '@/services/companyProfileService';

// The tenant's own uploaded logo (Configuration -> Company Info), shown next
// to the StoneSuite mark in the header — desktop pill and mobile badge are
// the same image, just boxed differently, since the backend stores only one
// logo per tenant. Renders nothing at all when no logo is set, for a portal
// session (no company_profile access), or while the request is in flight —
// no hardcoded fallback branding for a tenant that hasn't uploaded one.
export function TenantLogoMark() {
  const isCustomer = useAuthStore((s) => s.kind === 'portal');

  const { data } = useQuery({
    queryKey: ['company-profile'],
    queryFn: companyProfileService.get,
    enabled: !isCustomer,
  });

  if (!data?.logoUrl) return null;

  const alt = data.companyName ? `${data.companyName} logo` : 'Company logo';

  return (
    <>
      <div className="hidden lg:block h-7 w-px bg-white/12 mx-1" />
      <div className="hidden lg:flex items-center px-3">
        <img src={data.logoUrl} alt={alt} className="h-10 w-auto max-w-[140px] object-contain" />
      </div>
      <div className="flex lg:hidden items-center pl-2">
        <img src={data.logoUrl} alt={alt} className="h-8 w-auto max-w-[110px] object-contain" />
      </div>
    </>
  );
}
