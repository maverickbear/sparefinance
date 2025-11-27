"use client";

export function PartnersSection() {
  return (
    <section className="py-16 md:py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            FINANCE MANAGEMENT
          </p>
          <h3 className="text-xl font-semibold text-foreground">
            Partnering with top tier brands to revolutionize financial services.
          </h3>
        </div>
        {/* Partners logos would go here - placeholder for now */}
        <div className="flex items-center justify-center gap-8 md:gap-12 flex-wrap opacity-60">
          <div className="text-base font-medium text-muted-foreground">Plaid</div>
          <div className="text-base font-medium text-muted-foreground">Stripe</div>
        </div>
      </div>
    </section>
  );
}

