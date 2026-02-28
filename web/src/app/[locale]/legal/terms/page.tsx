import { GlassPanel } from '@/components/ui/GlassPanel';

export default function TermsPage() {
  return (
    <div className="min-h-screen pt-28 pb-20 px-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold mb-8 text-white">Terms of Service</h1>
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
              These Terms of Service (&quot;Terms&quot;) govern your use of the HelixMind platform,
              including the CLI tool, web dashboard, API, and all related services
              (&quot;Services&quot;) provided by HelixMind (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;).
              By accessing or using our Services, you agree to be bound by these Terms.
            </p>

            <hr className="border-white/5 my-8" />

            <h2>1. Acceptance of Terms</h2>
            <p>
              By creating an account, installing the CLI, or otherwise accessing our Services,
              you confirm that you are at least 16 years of age and agree to comply with these
              Terms. If you are using the Services on behalf of an organization, you represent
              that you have the authority to bind that organization to these Terms.
            </p>

            <hr className="border-white/5 my-8" />

            <h2>2. Description of Services</h2>
            <p>HelixMind provides:</p>
            <ul>
              <li>An AI coding CLI tool with persistent spiral context memory</li>
              <li>A web dashboard for account management, subscription billing, and support</li>
              <li>API access for integration with third-party tools (on applicable plans)</li>
              <li>Documentation, blog content, and community resources</li>
            </ul>
            <p>
              We reserve the right to modify, suspend, or discontinue any part of the Services
              at any time with reasonable notice.
            </p>

            <hr className="border-white/5 my-8" />

            <h2>3. Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials
              and for all activities that occur under your account. You agree to:
            </p>
            <ul>
              <li>Provide accurate and complete registration information</li>
              <li>Keep your password secure and not share it with others</li>
              <li>Notify us immediately of any unauthorized access to your account</li>
              <li>Not create multiple accounts to circumvent plan limitations</li>
            </ul>
            <p>
              We may suspend or terminate accounts that violate these Terms or that show signs
              of fraudulent activity.
            </p>

            <hr className="border-white/5 my-8" />

            <h2>4. Payment and Subscriptions</h2>

            <h3>4.1 Free Tier</h3>
            <p>
              The HelixMind CLI is free and open source under the AGPL-3.0 license. No account
              or payment is required for local usage with your own API keys or local models
              (e.g., Ollama).
            </p>

            <h3>4.2 Paid Plans</h3>
            <p>
              Pro (19 EUR/month) and Team (39 EUR/user/month) plans are billed monthly or annually
              through Stripe. Enterprise plans are available with custom pricing upon request.
            </p>

            <h3>4.3 Billing</h3>
            <p>
              Subscriptions automatically renew at the end of each billing cycle unless cancelled.
              You may cancel your subscription at any time through the Stripe customer portal.
              Cancellation takes effect at the end of your current billing period.
            </p>

            <h3>4.4 Refunds</h3>
            <p>
              We generally do not offer refunds for partial billing periods. If you believe you
              have been incorrectly charged, contact us at legal@helixmind.dev within 14 days
              of the charge.
            </p>

            <hr className="border-white/5 my-8" />

            <h2>5. Intellectual Property</h2>

            <h3>5.1 CLI Tool</h3>
            <p>
              The HelixMind CLI is licensed under the GNU Affero General Public License v3.0
              (AGPL-3.0). You may use, modify, and redistribute the CLI in accordance with
              that license. The full license text is available in the project repository.
            </p>

            <h3>5.2 Web Platform</h3>
            <p>
              The HelixMind web platform, dashboard, API, and associated proprietary features
              are proprietary software. You are granted a limited, non-exclusive, non-transferable
              license to use the web platform for its intended purpose during your active subscription.
            </p>

            <h3>5.3 Your Content</h3>
            <p>
              You retain ownership of all code, data, and content you create or store using
              HelixMind. We do not claim any intellectual property rights over your content.
              Spiral memory data stored locally on your machine remains entirely yours.
            </p>

            <hr className="border-white/5 my-8" />

            <h2>6. Acceptable Use</h2>
            <p>You agree not to use the Services to:</p>
            <ul>
              <li>Violate any applicable laws or regulations</li>
              <li>Reverse engineer, decompile, or redistribute paid/proprietary features</li>
              <li>Share API keys or account credentials with unauthorized parties</li>
              <li>Attempt to gain unauthorized access to our systems or other users&apos; accounts</li>
              <li>Use the Services for automated scraping, spamming, or denial-of-service attacks</li>
              <li>Interfere with or disrupt the integrity or performance of the Services</li>
            </ul>

            <hr className="border-white/5 my-8" />

            <h2>7. Termination</h2>
            <p>
              You may terminate your account at any time through your dashboard settings. We may
              terminate or suspend your account if:
            </p>
            <ul>
              <li>You violate these Terms or our Acceptable Use policy</li>
              <li>Your account shows signs of fraudulent or illegal activity</li>
              <li>We are required to do so by law</li>
            </ul>
            <p>
              Upon termination, your right to access paid features ceases immediately. You may
              export your data before account deletion. We will retain billing records as required
              by law.
            </p>

            <hr className="border-white/5 my-8" />

            <h2>8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, HelixMind and its maintainers
              shall not be liable for any indirect, incidental, special, consequential, or
              punitive damages, including but not limited to loss of profits, data, or business
              opportunities, arising from your use of or inability to use the Services.
            </p>
            <p>
              The Services are provided &quot;as is&quot; and &quot;as available&quot; without warranties
              of any kind, either express or implied, including but not limited to implied
              warranties of merchantability, fitness for a particular purpose, and non-infringement.
            </p>
            <p>
              Our total liability to you for any claims arising from or related to these Terms
              or the Services shall not exceed the amount you paid us in the 12 months preceding
              the claim.
            </p>

            <hr className="border-white/5 my-8" />

            <h2>9. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless HelixMind and its maintainers from any
              claims, damages, losses, or expenses (including reasonable legal fees) arising from
              your use of the Services or violation of these Terms.
            </p>

            <hr className="border-white/5 my-8" />

            <h2>10. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. Material changes will be communicated
              at least 30 days in advance via email or through a notice on our platform.
              Continued use of the Services after the effective date of changes constitutes
              acceptance of the updated Terms.
            </p>

            <hr className="border-white/5 my-8" />

            <h2>11. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of the
              Federal Republic of Germany, without regard to conflict of law provisions.
              Any disputes arising under these Terms shall be subject to the exclusive
              jurisdiction of the courts located in Germany.
            </p>

            <hr className="border-white/5 my-8" />

            <h2>12. Contact</h2>
            <p>For questions about these Terms, contact us at:</p>
            <p>
              <strong>Email:</strong> legal@helixmind.dev<br />
              <strong>Address:</strong><br />
              HelixMind<br />
              [Street Address]<br />
              [City, Postal Code]<br />
              Germany
            </p>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
