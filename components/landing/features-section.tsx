"use client";

export function FeaturesSection() {
  const stats = [
    { value: "100%", label: "Secure & Encrypted", icon: "🔒" },
    { value: "Auto", label: "Bank Sync", icon: "⚡" },
    { value: "24/7", label: "Real-Time Updates", icon: "🔄" },
    { value: "$0", label: "Start Free", icon: "✨" },
  ];

  return (
    <section id="features" className="pt-20 md:pt-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-3xl md:text-4xl font-bold">{stat.value}</span>
                <span className="text-2xl text-primary">{stat.icon}</span>
              </div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

