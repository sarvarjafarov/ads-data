import { getAllAds } from '@/lib/api'
import AdCard from '@/components/AdCard'

export default async function AdsPage() {
  const ads = await getAllAds()

  return (
    <div className="pt-20">
      {/* Hero */}
      <section className="section-padding relative overflow-hidden bg-gradient-to-br from-primary/10 to-secondary/10">
        <div className="container-custom relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl lg:text-7xl font-black mb-6">
              Browse <span className="text-gradient">All Ads</span>
            </h1>
            <p className="text-xl text-white/70">
              Discover our collection of advertising campaigns
            </p>
          </div>
        </div>
      </section>

      {/* Ads Grid */}
      <section className="py-20">
        <div className="container-custom">
          {ads.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📭</div>
              <h2 className="text-2xl font-bold mb-4">No Ads Found</h2>
              <p className="text-white/60">
                Check back later for new advertising campaigns
              </p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold">
                  All Ads <span className="text-primary">({ads.length})</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {ads.map((ad) => (
                  <AdCard key={ad.id} ad={ad} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
