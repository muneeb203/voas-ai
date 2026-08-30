import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-16">
      <div>
        <h1 className="text-4xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-muted-foreground">Last updated: 2026-08-31</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Agreement to Terms</h2>
        <p className="text-sm text-muted-foreground">
          By accessing and using this website, you accept and agree to be bound by the terms and
          provision of this agreement. If you do not agree to abide by the above, please do not use
          this service.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Use License</h2>
        <p className="text-sm text-muted-foreground">
          Permission is granted to temporarily download one copy of the materials (information or
          software) on VOAS AI's website for personal, non-commercial transitory viewing only. This
          is the grant of a license, not a transfer of title, and under this license you may not:
        </p>
        <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
          <li>Modify or copy the materials</li>
          <li>Use the materials for any commercial purpose or for any public display</li>
          <li>Attempt to reverse engineer any software contained on the website</li>
          <li>Transmit or store any content you do not own or have rights to</li>
          <li>Remove any copyright or proprietary notations</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Disclaimer</h2>
        <p className="text-sm text-muted-foreground">
          The materials on VOAS AI's website are provided for informational purposes only. VOAS AI
          makes no warranties, expressed or implied, and hereby disclaims and negates all other
          warranties. Further, VOAS AI does not warrant or make any representations concerning the
          accuracy, likely results, or reliability of the use of the materials on its website or
          otherwise relating to such materials or on any sites linked to this website.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Limitations of Liability</h2>
        <p className="text-sm text-muted-foreground">
          In no event shall VOAS AI or its suppliers be liable for any damages (including, without
          limitation, damages for loss of data or profit, or due to business interruption) arising
          out of the use or inability to use the materials on VOAS AI's website, even if VOAS AI
          or an authorized representative has been notified orally or in writing of the possibility
          of such damage.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Accuracy of Materials</h2>
        <p className="text-sm text-muted-foreground">
          The materials appearing on VOAS AI's website could include technical, typographical, or
          photographic errors. VOAS AI does not warrant that any of the materials on its website are
          accurate, complete, or current. VOAS AI may make changes to the materials contained on its
          website at any time without notice.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Links</h2>
        <p className="text-sm text-muted-foreground">
          VOAS AI has not reviewed all of the sites linked to its website and is not responsible for
          the contents of any such linked site. The inclusion of any link does not imply endorsement
          by VOAS AI of the site. Use of any such linked website is at the user's own risk.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Modifications</h2>
        <p className="text-sm text-muted-foreground">
          VOAS AI may revise these terms of service for its website at any time without notice. By
          using this website, you are agreeing to be bound by the then current version of these
          terms of service.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Governing Law</h2>
        <p className="text-sm text-muted-foreground">
          These terms and conditions are governed by and construed in accordance with the laws of
          the jurisdiction where VOAS AI operates, and you irrevocably submit to the exclusive
          jurisdiction of the courts in that location.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Contact Us</h2>
        <p className="text-sm text-muted-foreground">
          If you have any questions about these Terms of Service, please contact us at{' '}
          <a href="mailto:support@voas.ai" className="text-primary hover:underline">
            support@voas.ai
          </a>
        </p>
      </section>
    </div>
  );
}
