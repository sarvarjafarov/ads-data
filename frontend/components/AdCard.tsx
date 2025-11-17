import Link from 'next/link'
import Image from 'next/image'
import { Ad } from '@/lib/api'

interface AdCardProps {
  ad: Ad
}

export default function AdCard({ ad }: AdCardProps) {
  return (
    <Link href={`/ads/${ad.id}`}>
      <div className="card group cursor-pointer overflow-hidden h-full flex flex-col">
        {/* Image */}
        <div className="relative h-64 -m-6 mb-6 overflow-hidden rounded-t-2xl">
          <Image
            src={ad.image || 'https://via.placeholder.com/400x300'}
            alt={ad.title}
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

          {/* Status Badge */}
          <div className="absolute top-4 right-4">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                ad.status === 'active'
                  ? 'bg-primary text-black'
                  : ad.status === 'inactive'
                  ? 'bg-red-500 text-white'
                  : 'bg-yellow-500 text-black'
              }`}
            >
              {ad.status}
            </span>
          </div>

          {/* Category */}
          <div className="absolute bottom-4 left-4">
            <span className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-xs font-semibold border border-white/20">
              {ad.category}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
          <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
            {ad.title}
          </h3>
          <p className="text-white/60 text-sm mb-4 line-clamp-2 flex-1">
            {ad.description}
          </p>

          {/* Price */}
          <div className="flex justify-between items-center pt-4 border-t border-white/10">
            <span className="text-2xl font-bold text-primary">
              ${parseFloat(ad.price.toString()).toFixed(2)}
            </span>
            <span className="text-sm text-white/40">
              {new Date(ad.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
