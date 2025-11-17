'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <nav className="fixed w-full z-50 bg-black/90 backdrop-blur-lg border-b border-white/5">
      <div className="container-custom">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link href="/" className="text-xl font-bold flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-black font-black text-sm">AD</span>
            </div>
            <span className="text-white">AdsData</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/ads" className="text-white/70 hover:text-white transition-colors text-sm font-medium">
              Browse Ads
            </Link>
            <Link href="/about" className="text-white/70 hover:text-white transition-colors text-sm font-medium">
              About
            </Link>
            <Link href="/contact" className="text-white/70 hover:text-white transition-colors text-sm font-medium">
              Contact
            </Link>
            <Link href="http://localhost:3000/admin/login" target="_blank" className="btn-primary">
              Get started
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white"
            onClick={() => setIsOpen(!isOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-6 space-y-4 border-t border-white/10">
            <Link href="/ads" className="block text-white/70 hover:text-white transition-colors text-sm font-medium py-2">
              Browse Ads
            </Link>
            <Link href="/about" className="block text-white/70 hover:text-white transition-colors text-sm font-medium py-2">
              About
            </Link>
            <Link href="/contact" className="block text-white/70 hover:text-white transition-colors text-sm font-medium py-2">
              Contact
            </Link>
            <Link
              href="http://localhost:3000/admin/login"
              target="_blank"
              className="block btn-primary text-center mt-4"
            >
              Get started
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
