import { Hero } from '@/components/landing/Hero';
import { ProblemSection } from '@/components/landing/ProblemSection';
import { SpiralExplainer } from '@/components/landing/SpiralExplainer';
import { FeatureGrid } from '@/components/landing/FeatureGrid';
import { CodeDemo } from '@/components/landing/CodeDemo';
import { ComparisonTable } from '@/components/landing/ComparisonTable';
import { PricingPreview } from '@/components/landing/PricingPreview';
import { CtaSection } from '@/components/landing/CtaSection';

export default function HomePage() {
  return (
    <>
      <Hero />
      <ProblemSection />
      <SpiralExplainer />
      <FeatureGrid />
      <CodeDemo />
      <ComparisonTable />
      <PricingPreview />
      <CtaSection />
    </>
  );
}
