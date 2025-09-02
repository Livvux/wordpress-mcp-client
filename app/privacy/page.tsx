import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - wpAgent',
  description: 'How wpagent.app collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 prose dark:prose-invert">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">
        Last updated: September 2, 2025
      </p>

      <p>
        This Privacy Policy explains how wpAgent ("we", "us", or "our")
        collects, uses, and protects information when you use wpagent.app and
        related services (the "Service").
      </p>

      <h2>1. Information We Collect</h2>
      <p>
        We may collect: account information (e.g., name, email), usage
        information (e.g., device, browser, pages viewed), configuration data
        you provide to connect third-party services (e.g., WordPress sites,
        access tokens), and diagnostic logs to maintain and improve the Service.
      </p>

      <h2>2. How We Use Information</h2>
      <p>
        We use information to operate, maintain, and improve the Service;
        provide support; communicate with you; enhance security; comply with
        legal obligations; and develop new features. We do not sell personal
        information.
      </p>

      <h2>3. Data Processing with Third Parties</h2>
      <p>
        The Service may integrate with third-party providers (e.g., AI models,
        storage, analytics, authentication, WordPress APIs). Data shared with
        such providers is limited to what is necessary for the integration and
        is governed by those providers’ policies.
      </p>

      <h2>4. Cookies and Similar Technologies</h2>
      <p>
        We may use cookies and similar technologies to remember preferences,
        authenticate sessions, analyze usage, and improve the user experience.
        You can control cookies through your browser settings.
      </p>

      <h2>5. Data Retention</h2>
      <p>
        We retain information for as long as necessary to provide the Service,
        comply with legal obligations, resolve disputes, and enforce our
        agreements. Retention periods may vary by data type and context.
      </p>

      <h2>6. Security</h2>
      <p>
        We implement reasonable technical and organizational measures to protect
        your information. However, no system is completely secure, and we cannot
        guarantee absolute security.
      </p>

      <h2>7. Your Rights</h2>
      <p>
        Depending on your jurisdiction, you may have rights to access, correct,
        delete, or restrict processing of your personal information. To make a
        request, contact us using the information below.
      </p>

      <h2>8. International Transfers</h2>
      <p>
        If we transfer information across borders, we will take appropriate
        measures to ensure transfers comply with applicable data protection
        laws.
      </p>

      <h2>9. Children’s Privacy</h2>
      <p>
        The Service is not directed to children under 13 (or the age required by
        local law). We do not knowingly collect personal information from
        children.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. If we make material
        changes, we will provide notice as appropriate. Your continued use of
        the Service after changes become effective constitutes acceptance.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions or requests regarding this Privacy Policy can be sent to
        privacy@wpagent.app.
      </p>
    </main>
  );
}
