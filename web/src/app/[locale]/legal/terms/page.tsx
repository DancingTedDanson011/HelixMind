import { GlassPanel } from '@/components/ui/GlassPanel';
import { getTranslations } from 'next-intl/server';

type SubSection = {
  heading: string;
  content?: string;
  contentPre?: string;
  contentPost?: string;
  items?: string[];
};

type Section = {
  heading: string;
  content?: string;
  contentPre?: string;
  contentPost?: string;
  items?: string[];
  subSections?: SubSection[];
  emailLabel?: string;
  addressLabel?: string;
  address?: string;
};

export default async function TermsPage() {
  const t = await getTranslations('legal.terms');
  const sections = t.raw('sections') as Section[];

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
            <p className="text-gray-400 text-sm">{t('lastUpdated')}</p>

            <p>{t('intro')}</p>

            {sections.map((section, i) => (
              <div key={i}>
                <hr className="border-white/5 my-8" />
                <h2>{section.heading}</h2>

                {section.contentPre && <p>{section.contentPre}</p>}
                {section.content && <p>{section.content}</p>}

                {section.items && (
                  <ul>
                    {section.items.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                )}

                {section.contentPost && <p>{section.contentPost}</p>}

                {section.subSections && section.subSections.map((sub, j) => (
                  <div key={j}>
                    <h3>{sub.heading}</h3>
                    {sub.contentPre && <p>{sub.contentPre}</p>}
                    {sub.content && <p>{sub.content}</p>}
                    {sub.items && (
                      <ul>
                        {sub.items.map((item, k) => (
                          <li key={k}>{item}</li>
                        ))}
                      </ul>
                    )}
                    {sub.contentPost && <p>{sub.contentPost}</p>}
                  </div>
                ))}

                {section.emailLabel && section.addressLabel && (
                  <p>
                    <strong>{section.emailLabel}:</strong> legal@helixmind.dev<br />
                    <strong>{section.addressLabel}:</strong><br />
                    {section.address?.split('\n').map((line, j) => (
                      <span key={j}>{line}<br /></span>
                    ))}
                  </p>
                )}
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
