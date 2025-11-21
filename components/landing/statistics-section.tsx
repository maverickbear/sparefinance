"use client";

export function StatisticsSection() {
  const stats = [
    {
      value: "11K+",
      label: "Financial institutions supported via Plaid",
    },
    {
      value: "100%",
      label: "Secure bank-level encryption",
    },
    {
      value: "24/7",
      label: "Automatic transaction sync",
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
            Statistics
          </p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4">
            See Your<br />Wealth Grow
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16 max-w-5xl mx-auto">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-6xl sm:text-7xl md:text-8xl font-bold text-foreground mb-6">
                {stat.value}
              </div>
              <p className="text-lg text-muted-foreground font-medium leading-relaxed">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

