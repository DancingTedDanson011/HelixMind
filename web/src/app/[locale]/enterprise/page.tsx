import { EnterpriseHero } from '@/components/enterprise/EnterpriseHero';
import { EnterpriseProblem } from '@/components/enterprise/EnterpriseProblem';
import { EnterpriseSolution } from '@/components/enterprise/EnterpriseSolution';
import { EnterpriseModes } from '@/components/enterprise/EnterpriseModes';
import { EnterpriseWhy } from '@/components/enterprise/EnterpriseWhy';
import { EnterpriseIntegration } from '@/components/enterprise/EnterpriseIntegration';
import { EnterpriseROI } from '@/components/enterprise/EnterpriseROI';
import { EnterpriseTraction } from '@/components/enterprise/EnterpriseTraction';
import { EnterpriseCTA } from '@/components/enterprise/EnterpriseCTA';

export default function EnterprisePage() {
  return (
    <>
      <EnterpriseHero />
      <EnterpriseProblem />
      <EnterpriseSolution />
      <EnterpriseModes />
      <EnterpriseWhy />
      <EnterpriseIntegration />
      <EnterpriseROI />
      <EnterpriseTraction />
      <EnterpriseCTA />
    </>
  );
}
