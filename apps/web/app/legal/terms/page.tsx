export default function TermsOfService() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-6 py-12">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="text-muted-foreground">Last updated: August 31, 2026</p>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">1. Agreement to Terms</h2>
        <p>
          By accessing and using VOAS AI, you accept and agree to be bound by the terms of this
          agreement.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">2. Use License</h2>
        <p>Permission is granted to use this service for lawful purposes only. You may not:</p>
        <ul className="list-inside space-y-2 text-muted-foreground">
          <li>- Copy or modify materials without permission</li>
          <li>- Use materials for commercial purposes without authorization</li>
          <li>- Attempt to decompile or reverse engineer the service</li>
          <li>- Remove copyright or proprietary notices</li>
          <li>- Transfer materials to another person or server</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">3. Disclaimer</h2>
        <p>
          Materials are provided "as is" without warranties. VOAS AI disclaims all warranties, expressed
          or implied.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">4. Limitations</h2>
        <p>
          VOAS AI shall not be liable for damages arising from use or inability to use the service, even
          if notified of such damage possibility.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">5. Modifications</h2>
        <p>
          VOAS AI may revise these terms at any time without notice. Your use indicates acceptance of
          current terms.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">6. Governing Law</h2>
        <p>These terms are governed by the laws of Pakistan.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">7. Contact</h2>
        <p>For questions, contact us at support@voas.ai.</p>
      </section>
    </div>
  );
}
