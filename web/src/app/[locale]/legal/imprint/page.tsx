import { GlassPanel } from '@/components/ui/GlassPanel';
import { getTranslations } from 'next-intl/server';

type Section = {
  heading: string;
  content?: string;
  contentPost?: string;
  emailLabel?: string;
  webLabel?: string;
};

export default async function ImprintPage() {
  const t = await getTranslations('legal.imprint');
  const sections = t.raw('sections') as Section[];

  // Section indices for structural rendering:
  // 0 = TMG info (address block)
  // 1 = Contact (email + web)
  // 2 = Represented by (content)
  // 3 = Responsible for content (address block)
  // 4 = EU Dispute Resolution (ODR link)
  // 5 = Liability for Content (two paragraphs)
  // 6 = Liability for Links (two paragraphs)
  // 7 = Copyright (two paragraphs)

  return (
    <div className="min-h-screen pt-28 pb-20 px-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold mb-8 text-white">{t('title')}</h1>
        <GlassPanel className="p-8 lg:p-12">
          <div className="prose prose-invert prose-sm max-w-none
            prose-headings:text-white prose-headings:font-semibold
            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
            prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
            prose-p:text-gray-300 prose-p:leading-relaxed
            prose-li:text-gray-300
            prose-strong:text-white
          ">
            {sections.map((section, i) => (
              <div key={i}>
                {i > 0 && <hr className="border-white/5 my-8" />}
                <h2>{section.heading}</h2>

                {/* Address block sections (TMG info and Responsible for content) */}
                {section.content && i !== 1 && i !== 4 && (
                  <p>
                    {section.content.split('\n').map((line, j, arr) => (
                      <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
                    ))}
                  </p>
                )}

                {/* Contact section */}
                {i === 1 && section.emailLabel && section.webLabel && (
                  <p>
                    <strong>{section.emailLabel}:</strong> legal@helixmind.dev<br />
                    <strong>{section.webLabel}:</strong> https://helixmind.dev
                  </p>
                )}

                {/* EU Dispute Resolution — ODR link */}
                {i === 4 && section.content && (
                  <p>
                    {section.content}{' '}
                    <a
                      href="https://ec.europa.eu/consumers/odr/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      https://ec.europa.eu/consumers/odr/
                    </a>
                  </p>
                )}

                {section.contentPost && <p>{section.contentPost}</p>}
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
