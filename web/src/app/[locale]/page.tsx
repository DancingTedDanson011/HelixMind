import { Hero } from '@/components/landing/Hero';
import { ModesShowcase } from '@/components/landing/ModesShowcase';
import { BrainShowcase } from '@/components/landing/BrainShowcase';
import { FeatureGrid } from '@/components/landing/FeatureGrid';
import { OpenSourceBanner } from '@/components/landing/OpenSourceBanner';
import { PricingPreview } from '@/components/landing/PricingPreview';
import { CtaSection } from '@/components/landing/CtaSection';

export default function HomePage() {
  return (
    <>
      <Hero />
      <ModesShowcase />
      <BrainShowcase />
      <FeatureGrid />
      <OpenSourceBanner />
      <PricingPreview />
      <CtaSection />
    </>
  );
}
