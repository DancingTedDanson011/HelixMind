import { GlassPanel } from '@/components/ui/GlassPanel';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen pt-28 pb-20 px-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold mb-8 text-white">Privacy Policy</h1>
        <GlassPanel className="p-8 lg:p-12">
          <div className="prose prose-invert prose-sm max-w-none
            prose-headings:text-white prose-headings:font-semibold
            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
            prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
            prose-p:text-gray-300 prose-p:leading-relaxed
            prose-li:text-gray-300
            prose-strong:text-white
          ">
            <p className="text-gray-400 text-sm">Last updated: February 2026</p>

            <p>
              HelixMind (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is committed to protecting
              your privacy. This Privacy Policy explains how we collect, use, store, and protect
              your personal data when you use our web platform and CLI tool, in accordance with
              the General Data Protection Regulation (GDPR) and applicable data protection laws.
            </p>

            <hr className="border-white/5 my-8" />

            <h2>1. Data Collection</h2>

            <h3>1.1 Account Data</h3>
            <p>
              When you create an account on the HelixMind web platform, we collect the following information:
            </p>
            <ul>
              <li>Email address</li>
              <li>Name (if provided)</li>
              <li>Profile information from OAuth providers (GitHub) if you choose to authenticate via third-party services</li>
            </ul>

            <h3>1.2 Payment Data</h3>
            <p>
              Payment information (credit card numbers, billing addresses) is processed exclusively
              by our payment provider, Stripe. We do not store your full credit card details on
              our servers. We retain only a reference ID, card brand, and last four digits for
              display purposes in your dashboard.
            </p>

            <h3>1.3 Usage Data</h3>
            <p>
              We collect anonymized usage data to improve our services, including API call counts,
              feature usage statistics, and error reports. This data does not contain personally
              identifiable information.
            </p>

            <h3>1.4 CLI Data</h3>
            <p>
              The HelixMind CLI tool stores all data locally on your machine by default. Spiral
              memory, project context, and configuration files remain on your local file system
              and are never transmitted to our servers unless you explicitly enable Cloud Brain
              Sync (available on Pro and Team plans).
            </p>

            <h3>1.5 Cookies</h3>
            <p>
              We use essential cookies required for authentication and session management. We do
              not use third-party tracking cookies or advertising cookies. If we introduce
              analytics in the future, we will update this policy and request your consent.
            </p>

            <hr className="border-white/5 my-8" />

            <h2>2. How We Use Your Data</h2>
            <p>We process your personal data for the following purposes:</p>
            <ul>
              <li>Providing and maintaining your account and access to our services</li>
              <li>Processing subscription payments via Stripe</li>
              <li>Sending transactional emails (account verification, password resets, billing notifications) via Resend</li>
              <li>Providing customer support through our ticket system</li>
              <li>Improving our services based on anonymized usage patterns</li>
              <li>Ensuring platform security and preventing abuse</li>
            </ul>
            <p>
              <strong>Legal basis:</strong> We process your data based on contractual necessity
              (providing the service you signed up for), legitimate interest (improving our
              services and preventing abuse), and consent (where explicitly given).
            </p>

            <hr className="border-white/5 my-8" />

            <h2>3. Data Storage and Security</h2>
            <p>
              Your account data is stored in a PostgreSQL database hosted on secure,
              encrypted infrastructure. We implement industry-standard security measures including:
            </p>
            <ul>
              <li>Encryption at rest and in transit (TLS 1.3)</li>
              <li>Secure password hashing (bcrypt)</li>
              <li>JWT-based authentication with appropriate expiration</li>
              <li>Regular security audits and dependency updates</li>
            </ul>
            <p>
              Data is retained for as long as your account is active. Upon account deletion,
              your personal data is permanently removed within 30 days, except where retention
              is required by law (e.g., billing records for tax purposes).
            </p>

            <hr className="border-white/5 my-8" />

            <h2>4. Third-Party Services</h2>
            <p>We share data with the following third-party processors, solely for the purposes described:</p>
            <ul>
              <li><strong>Stripe</strong> — Payment processing and subscription management</li>
              <li><strong>Resend</strong> — Transactional email delivery</li>
              <li><strong>GitHub</strong> — OAuth authentication (only if you choose GitHub login)</li>
            </ul>
            <p>
              Each third-party processor operates under their own privacy policy and is bound by
              data processing agreements. We do not sell your personal data to any third party.
            </p>

            <hr className="border-white/5 my-8" />

            <h2>5. Your Rights (GDPR)</h2>
            <p>Under the GDPR, you have the following rights regarding your personal data:</p>
            <ul>
              <li><strong>Right of Access</strong> — Request a copy of all personal data we hold about you</li>
              <li><strong>Right to Rectification</strong> — Request correction of inaccurate data</li>
              <li><strong>Right to Erasure</strong> — Request deletion of your personal data (&quot;right to be forgotten&quot;)</li>
              <li><strong>Right to Restriction</strong> — Request limitation of data processing</li>
              <li><strong>Right to Data Portability</strong> — Receive your data in a structured, machine-readable format</li>
              <li><strong>Right to Object</strong> — Object to processing based on legitimate interest</li>
              <li><strong>Right to Withdraw Consent</strong> — Withdraw previously given consent at any time</li>
            </ul>
            <p>
              You can exercise most of these rights directly through your dashboard settings
              (account export, account deletion). For other requests, please contact us at
              the address below.
            </p>

            <hr className="border-white/5 my-8" />

            <h2>6. Data Transfers</h2>
            <p>
              If your data is transferred outside the European Economic Area (EEA), we ensure
              appropriate safeguards are in place, such as Standard Contractual Clauses (SCCs)
              approved by the European Commission.
            </p>

            <hr className="border-white/5 my-8" />

            <h2>7. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be
              communicated via email or through a notice on our platform. The &quot;Last updated&quot;
              date at the top of this page indicates the most recent revision.
            </p>

            <hr className="border-white/5 my-8" />

            <h2>8. Contact</h2>
            <p>
              For privacy inquiries, data access requests, or complaints, contact us at:
            </p>
            <p>
              <strong>Email:</strong> legal@helixmind.dev<br />
              <strong>Address:</strong><br />
              HelixMind<br />
              [Street Address]<br />
              [City, Postal Code]<br />
              Germany
            </p>
            <p>
              If you believe your data protection rights have been violated, you have the right
              to lodge a complaint with a supervisory authority in your EU member state of
              residence.
            </p>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
