import { Hero } from '@/components/landing/Hero';
import { ProblemSection } from '@/components/landing/ProblemSection';
import { SpiralExplainer } from '@/components/landing/SpiralExplainer';
import { FeatureGrid } from '@/components/landing/FeatureGrid';
import { TerminalShowcase } from '@/components/landing/TerminalShowcase';
import { ComparisonTable } from '@/components/landing/ComparisonTable';
import { PricingPreview } from '@/components/landing/PricingPreview';
import { CtaSection } from '@/components/landing/CtaSection';

export default function HomePage() {
  return (
    <>
      <Hero />
      <TerminalShowcase />
      <ProblemSection />
      <SpiralExplainer />
      <FeatureGrid />
      <ComparisonTable />
      <PricingPreview />
      <CtaSection />
    </>
  );
}
