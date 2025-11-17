import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-black border-t border-white/5">
      <div className="container-custom py-16">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
          {/* Brand */}
          <div>
            <Link href="/" className="text-xl font-bold inline-flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-black font-black text-sm">AD</span>
              </div>
              <span className="text-white">AdsData</span>
            </Link>
            <p className="text-sm text-white/40">&copy; 2025 AdsData</p>
          </div>

          {/* Links Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-12">
            {/* Product */}
            <div>
              <h3 className="text-white font-semibold mb-4 text-sm">Product</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/ads" className="text-white/60 hover:text-white transition-colors text-sm">
                    Browse Ads
                  </Link>
                </li>
                <li>
                  <Link href="http://localhost:3000/admin/login" target="_blank" className="text-white/60 hover:text-white transition-colors text-sm">
                    Admin Dashboard
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-white font-semibold mb-4 text-sm">Company</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/about" className="text-white/60 hover:text-white transition-colors text-sm">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-white/60 hover:text-white transition-colors text-sm">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="text-white font-semibold mb-4 text-sm">Legal</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="#" className="text-white/60 hover:text-white transition-colors text-sm">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-white/60 hover:text-white transition-colors text-sm">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
