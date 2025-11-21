"use client";

export function StatisticsSection() {
  const stats = [
    {
      value: "73%",
      label: "Of families live paycheck to paycheck—you don't have to",
    },
    {
      value: "6 mos",
      label: "To see real change when you track and plan together",
    },
    {
      value: "2.5x",
      label: "More likely to reach goals when the whole family is involved",
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
            The Reality
          </p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4">
            Most Families Are Stuck.<br />You Don't Have to Be.
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mt-6">
            While most families struggle to make ends meet, you can be one of the few who break the cycle. Start building wealth, not just paying bills.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16 max-w-5xl mx-auto">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-6">
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

