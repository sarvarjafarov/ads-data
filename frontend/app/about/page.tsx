export default function AboutPage() {
  return (
    <div className="pt-20">
      {/* Hero */}
      <section className="section-padding relative overflow-hidden bg-gradient-to-br from-primary/10 to-secondary/10">
        <div className="container-custom relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl lg:text-7xl font-black mb-6">
              About <span className="text-gradient">AdsData</span>
            </h1>
            <p className="text-xl text-white/70">
              Revolutionizing advertising with cutting-edge technology
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold mb-6">Our Mission</h2>
            <p className="text-xl text-white/70 leading-relaxed mb-8">
              At AdsData, we believe advertising should be powerful, data-driven, and accessible
              to everyone. Our platform combines modern technology with intuitive design to help
              businesses of all sizes create and manage successful advertising campaigns.
            </p>
            <p className="text-xl text-white/70 leading-relaxed">
              Built with Next.js, powered by real-time analytics, and designed for the future
              of digital advertising.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding bg-white/5">
        <div className="container-custom">
          <h2 className="text-4xl font-bold mb-12 text-center">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {values.map((value, index) => (
              <div key={index} className="card text-center">
                <div className="text-5xl mb-4">{value.icon}</div>
                <h3 className="text-2xl font-bold mb-3">{value.title}</h3>
                <p className="text-white/60">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="card text-center max-w-3xl mx-auto p-12">
            <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Advertising?</h2>
            <p className="text-white/70 mb-8">
              Join thousands of businesses using AdsData to reach their audience.
            </p>
            <a href="/ads" className="btn-primary inline-block">
              Explore Ads
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}

const values = [
  {
    icon: '💡',
    title: 'Innovation',
    description: 'Constantly pushing boundaries with the latest technology and creative solutions.',
  },
  {
    icon: '🎯',
    title: 'Precision',
    description: 'Data-driven targeting to ensure your message reaches the right audience.',
  },
  {
    icon: '🤝',
    title: 'Partnership',
    description: 'Building long-term relationships based on trust and mutual success.',
  },
]
