"use client";

export function TrustedBySection() {
  // Placeholder companies - can be replaced with actual logos
  const companies = [
    { name: "PictelAI" },
    { name: "Leapyear" },
    { name: "Magnolia" },
    { name: "Peregrin" },
    { name: "Stack&d Lab" },
  ];

  return (
    <section className="py-12 md:py-16 bg-background border-y border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">
            Trusted by world top companies
          </h2>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 opacity-60">
          {companies.map((company, index) => (
            <div
              key={index}
              className="text-lg font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              {company.name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

