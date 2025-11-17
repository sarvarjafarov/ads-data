import { getAdById, getAllAds } from '@/lib/api'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdDetailPage({ params }: Props) {
  const { id } = await params
  const ad = await getAdById(id)

  if (!ad) {
    notFound()
  }

  return (
    <div className="pt-20">
      {/* Back Button */}
      <div className="container-custom py-8">
        <Link
          href="/ads"
          className="inline-flex items-center text-white/60 hover:text-primary transition-colors"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Ads
        </Link>
      </div>

      {/* Ad Detail */}
      <section className="pb-20">
        <div className="container-custom">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Image */}
            <div className="relative h-[600px] rounded-3xl overflow-hidden">
              <Image
                src={ad.image || 'https://via.placeholder.com/800x600'}
                alt={ad.title}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

              {/* Category Badge */}
              <div className="absolute top-6 left-6">
                <span className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-sm font-semibold border border-white/20">
                  {ad.category}
                </span>
              </div>

              {/* Status Badge */}
              <div className="absolute top-6 right-6">
                <span
                  className={`px-4 py-2 rounded-full text-sm font-semibold ${
                    ad.status === 'active'
                      ? 'bg-primary text-black'
                      : ad.status === 'inactive'
                      ? 'bg-red-500 text-white'
                      : 'bg-yellow-500 text-black'
                  }`}
                >
                  {ad.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="flex flex-col justify-center">
              <h1 className="text-5xl lg:text-6xl font-black mb-6">
                {ad.title}
              </h1>

              <div className="flex items-baseline gap-4 mb-8">
                <span className="text-5xl font-bold text-primary">
                  ${parseFloat(ad.price.toString()).toFixed(2)}
                </span>
              </div>

              <div className="space-y-6 mb-10">
                <div>
                  <h2 className="text-xl font-bold mb-3 text-white/90">
                    Description
                  </h2>
                  <p className="text-white/70 text-lg leading-relaxed">
                    {ad.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-6 border-t border-white/10">
                  <div>
                    <p className="text-white/50 text-sm mb-1">Category</p>
                    <p className="text-white font-semibold">{ad.category}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-sm mb-1">Status</p>
                    <p className="text-white font-semibold capitalize">
                      {ad.status}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/50 text-sm mb-1">Created</p>
                    <p className="text-white font-semibold">
                      {new Date(ad.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/50 text-sm mb-1">Updated</p>
                    <p className="text-white font-semibold">
                      {new Date(ad.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button className="btn-primary flex-1">
                  Contact Seller
                </button>
                <button className="btn-secondary flex-1">
                  Save Ad
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related Ads */}
      <section className="py-20 bg-white/5">
        <div className="container-custom">
          <h2 className="text-3xl font-bold mb-8">
            More from <span className="text-primary">{ad.category}</span>
          </h2>
          <p className="text-white/60 mb-8">
            Explore similar advertising campaigns
          </p>
          <Link href="/ads" className="btn-primary inline-block">
            View All Ads
          </Link>
        </div>
      </section>
    </div>
  )
}

// Generate static params for all ads
export async function generateStaticParams() {
  const ads = await getAllAds()
  return ads.map((ad) => ({
    id: ad.id.toString(),
  }))
}
