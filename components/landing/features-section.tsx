"use client";

export function FeaturesSection() {
  const stats = [
    { value: "100%", label: "Secure & Encrypted", icon: "🔒" },
    { value: "Auto", label: "Bank Sync", icon: "⚡" },
    { value: "24/7", label: "Real-Time Updates", icon: "🔄" },
    { value: "$0", label: "Start Free", icon: "✨" },
  ];

  return (
    <section id="features" className="pt-32 md:pt-40 pb-20 md:pb-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Statistics - Apple Style */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 max-w-6xl mx-auto">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="flex flex-col items-center justify-center gap-3 mb-3">
                <span className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight">
                  {stat.value}
                </span>
                <span className="text-3xl md:text-4xl">{stat.icon}</span>
              </div>
              <p className="text-base md:text-lg text-muted-foreground font-light">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
