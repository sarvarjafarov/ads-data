import Link from 'next/link'

export default function Home() {
  return (
    <div className="pt-20">
      {/* Hero Section */}
      <section className="min-h-screen flex items-center relative overflow-hidden">
        <div className="container-custom w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left Content */}
            <div>
              <h1 className="heading-xl mb-8">
                Change how <span className="text-primary">ads</span> reach your audience
              </h1>

              <div className="flex flex-wrap gap-4 mb-12">
                <Link href="/ads" className="btn-primary">
                  Get started
                </Link>
                <Link href="/contact" className="btn-secondary">
                  Book a demo
                </Link>
              </div>
            </div>

            {/* Right Testimonial Card */}
            <div className="card relative">
              <div className="text-white/90 italic text-lg mb-8 leading-relaxed">
                "AdsData is not an ordinary platform. It's like teaching AI how to sell your product for you."
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  SM
                </div>
                <div>
                  <div className="font-semibold text-white">Sarah Mitchell</div>
                  <div className="text-sm text-white/60">Marketing Director</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition Section */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-4xl">
            <h2 className="heading-lg mb-12">
              AdsData helps brands discover <span className="text-primary italic">and change</span> how audiences engage
            </h2>
            <p className="text-xl text-white/70 leading-relaxed">
              AdsData drives more engagement by analyzing how your audience interacts
              with your brand and then creating campaigns that resonate with them.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-20">
            {insights.map((insight, index) => (
              <div key={index} className="card-minimal">
                <div className="w-12 h-12 rounded-full bg-primary text-black flex items-center justify-center font-bold mb-6">
                  {insight.number}
                </div>
                <p className="text-white/80 leading-relaxed">
                  {insight.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="section-padding bg-gray-darker">
        <div className="container-custom">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="text-8xl lg:text-9xl font-bold text-white/10 mb-6">+40%</div>
              <h3 className="heading-md mb-6">Drive real results</h3>
              <p className="text-lg text-white/70 leading-relaxed">
                On average, AdsData customers are seeing their campaign engagement
                increase 40% per month.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {stats.map((stat, index) => (
                <div key={index} className="card-minimal text-center">
                  <div className="text-4xl font-bold text-primary mb-2">{stat.value}</div>
                  <div className="text-white/60 text-sm">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="card text-center py-16">
            <h2 className="heading-md mb-6">
              Ready to transform your campaigns?
            </h2>
            <p className="text-xl text-white/70 mb-8 max-w-2xl mx-auto">
              Join leading brands using AdsData to drive better results
            </p>
            <Link href="/ads" className="btn-primary inline-block">
              Get started
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

const insights = [
  {
    number: 'I',
    text: 'Audiences are evolving; they seek authentic connections with brands that understand their needs.',
  },
  {
    number: 'II',
    text: 'Campaigns perform better when they speak directly to audience desires and pain points.',
  },
  {
    number: 'III',
    text: 'Measuring engagement in real-time allows brands to optimize and improve continuously.',
  },
]

const stats = [
  { value: '1000+', label: 'Active Campaigns' },
  { value: '50M+', label: 'Impressions' },
  { value: '99.9%', label: 'Uptime' },
  { value: '24/7', label: 'Support' },
]
