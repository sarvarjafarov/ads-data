# AdsData Frontend

Modern Next.js frontend for the AdsData advertising platform, inspired by [unusual.ai](https://www.unusual.ai/) design aesthetic.

## Design Features

- 🌑 **Dark Mode First** - Black background with high-contrast lime green (#b7fa31) accents
- ⚡ **Lightning Fast** - Built with Next.js 16 App Router for optimal performance
- 🎨 **Beautiful UI** - Modern, minimal design with Tailwind CSS
- 📱 **Fully Responsive** - Works perfectly on all devices
- 🔄 **Real-time Data** - Connected to backend API for dynamic content

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Fonts**: Inter (Google Fonts)
- **Images**: Next.js Image Optimization

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Backend API running on `http://localhost:3000`

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.local.example .env.local
```

3. Update `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
frontend/
├── app/                    # Next.js App Router
│   ├── ads/               # Ads listing and detail pages
│   ├── about/             # About page
│   ├── contact/           # Contact page
│   ├── globals.css        # Global styles with Tailwind
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Homepage
├── components/            # React components
│   ├── Navigation.tsx     # Header navigation
│   ├── Footer.tsx         # Footer component
│   └── AdCard.tsx         # Ad card component
├── lib/                   # Utility functions
│   └── api.ts             # API client functions
└── public/                # Static assets
```

## Pages

### Home (`/`)
- Hero section with gradient background
- Feature showcase
- Statistics cards
- Call-to-action sections

### Browse Ads (`/ads`)
- Grid layout of all ads
- Responsive card design
- Category and status badges
- Direct link to ad details

### Ad Detail (`/ads/[id]`)
- Large image display
- Detailed ad information
- Price and metadata
- Action buttons (Contact, Save)

### About (`/about`)
- Company mission and values
- Team information
- Call-to-action

### Contact (`/contact`)
- Contact form
- Company information
- Location and hours

## Design System

### Colors

```css
--primary: #b7fa31    /* Lime Green */
--secondary: #7c3aed  /* Purple */
--dark: #000000       /* Black */
```

### Typography

- **Font Family**: Inter
- **Headings**: 700-900 weight
- **Body**: 400-600 weight

### Components

- `btn-primary` - Primary action button (lime green background)
- `btn-secondary` - Secondary action button (outlined)
- `card` - Card component with blur effect
- `text-gradient` - Gradient text effect

## API Integration

The frontend connects to the backend API at `http://localhost:3000/api`:

- `GET /api/ads` - Fetch all ads
- `GET /api/ads/:id` - Fetch single ad by ID

### Example Usage

```typescript
import { getAllAds, getAdById } from '@/lib/api'

// Get all ads
const ads = await getAllAds()

// Get single ad
const ad = await getAdById('1')
```

## Deployment

### Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

### Other Platforms

1. Build the project:
```bash
npm run build
```

2. Deploy the `.next` folder to your hosting provider

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:3000/api` |

## Performance Optimizations

- ✅ Image optimization with Next.js Image component
- ✅ Font optimization with next/font
- ✅ Static page generation where possible
- ✅ Dynamic imports for code splitting
- ✅ Tailwind CSS purging for minimal bundle size

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

ISC
