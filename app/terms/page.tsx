import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - wpAgent',
  description: 'The terms of service governing use of wpagent.app.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 prose dark:prose-invert">
      <h1>Terms of Service</h1>
      <p className="text-sm text-muted-foreground">
        Last updated: September 2, 2025
      </p>

      <p>
        Welcome to wpAgent ("wpAgent", "we", "us", or "our"). These Terms of
        Service ("Terms") govern your access to and use of wpagent.app, the
        wpAgent application, APIs, and any related services (collectively, the
        "Service"). By accessing or using the Service, you agree to be bound by
        these Terms.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 18 years old and able to form a binding contract to
        use the Service. If you use the Service on behalf of an organization,
        you represent that you have authority to bind that organization to these
        Terms.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account
        credentials and for all activities under your account. Notify us
        immediately of any unauthorized use.
      </p>

      <h2>3. Acceptable Use</h2>
      <p>
        You agree not to misuse the Service, including without limitation by:
        attempting to access another user’s account; interfering with or
        disrupting the Service; reverse engineering or scraping where
        prohibited; or using the Service to transmit malicious code or content
        that infringes third-party rights or violates applicable law.
      </p>

      <h2>4. Content and IP</h2>
      <p>
        You retain ownership of content you submit to the Service. You grant us
        a non-exclusive, worldwide, royalty-free license to host, process, and
        display such content solely to provide and improve the Service. wpAgent
        trademarks, logos, and the Service are protected by intellectual
        property laws. No rights are granted except as expressly stated in these
        Terms.
      </p>

      <h2>5. Third-Party Services</h2>
      <p>
        The Service may integrate with third-party services (e.g., AI providers,
        WordPress, storage, or analytics). Your use of those services is subject
        to their terms and policies. We are not responsible for third-party
        services.
      </p>

      <h2>6. Fees and Payments</h2>
      <p>
        Paid features, if any, are billed as described at purchase. Fees are
        non-refundable except as required by law or expressly stated at the time
        of purchase.
      </p>

      <h2>7. Privacy</h2>
      <p>
        Please review our <a href="/privacy">Privacy Policy</a> for details on
        how we collect, use, and protect your information.
      </p>

      <h2>8. Warranty Disclaimer</h2>
      <p>
        THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF
        ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY,
        FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
      </p>

      <h2>9. Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, WPAGENT AND ITS AFFILIATES WILL
        NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
        PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED
        DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER
        INTANGIBLE LOSSES, RESULTING FROM YOUR USE OF THE SERVICE.
      </p>

      <h2>10. Termination</h2>
      <p>
        We may suspend or terminate your access to the Service at any time, for
        any reason, including violation of these Terms. Upon termination, the
        provisions intended to survive will remain in effect.
      </p>

      <h2>11. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. If we make material
        changes, we will provide notice as appropriate. Your continued use of
        the Service after changes become effective constitutes acceptance of the
        revised Terms.
      </p>

      <h2>12. Governing Law</h2>
      <p>
        These Terms are governed by the laws of the jurisdiction of our primary
        business establishment, without regard to conflict of laws principles.
      </p>

      <h2>13. Contact</h2>
      <p>Questions about these Terms? Contact us at support@wpagent.app.</p>
    </main>
  );
}
