import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-16">
      <div>
        <h1 className="text-4xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-muted-foreground">Last updated: 2026-08-31</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Introduction</h2>
        <p className="text-sm text-muted-foreground">
          VOAS AI ("we," "us," or "our") operates voas.ai. This page informs you of our policies
          regarding the collection, use, and disclosure of personal data when you use our Service
          and the choices you have associated with that data.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Information Collection and Use</h2>
        <p className="text-sm text-muted-foreground">
          We collect several different types of information for various purposes to provide and
          improve our Service to you.
        </p>
        <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
          <li>Account information (email, name, workspace details)</li>
          <li>Conversation data (phone calls, WhatsApp messages, chat)</li>
          <li>Customer information (appointment bookings, contact details)</li>
          <li>Usage analytics (feature usage, error logs)</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Data Security</h2>
        <p className="text-sm text-muted-foreground">
          The security of your data is important to us but remember that no method of transmission
          over the Internet or method of electronic storage is 100% secure. While we strive to use
          commercially acceptable means to protect your personal data, we cannot guarantee its
          absolute security.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Changes to This Privacy Policy</h2>
        <p className="text-sm text-muted-foreground">
          We may update our Privacy Policy from time to time. We will notify you of any changes by
          posting the new Privacy Policy on this page and updating the "Last updated" date at the
          top of this Privacy Policy.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Contact Us</h2>
        <p className="text-sm text-muted-foreground">
          If you have any questions about this Privacy Policy, please contact us at{' '}
          <a href="mailto:support@voas.ai" className="text-primary hover:underline">
            support@voas.ai
          </a>
        </p>
      </section>
    </div>
  );
}
