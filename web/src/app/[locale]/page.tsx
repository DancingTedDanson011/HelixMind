import { Hero } from '@/components/landing/Hero';
import { ModesShowcase } from '@/components/landing/ModesShowcase';
import { BrainShowcase } from '@/components/landing/BrainShowcase';
import { SpiralExplainer } from '@/components/landing/SpiralExplainer';
import { WebAppPreview } from '@/components/landing/WebAppPreview';
import { FeatureGrid } from '@/components/landing/FeatureGrid';
import { ComparisonTable } from '@/components/landing/ComparisonTable';
import { PricingPreview } from '@/components/landing/PricingPreview';
import { CtaSection } from '@/components/landing/CtaSection';

export default function HomePage() {
  return (
    <>
      <Hero />
      <ModesShowcase />
      <BrainShowcase />
      <SpiralExplainer />
      <WebAppPreview />
      <FeatureGrid />
      <ComparisonTable />
      <PricingPreview />
      <CtaSection />
    </>
  );
}
