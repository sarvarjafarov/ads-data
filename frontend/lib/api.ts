const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'

export interface Ad {
  id: number
  title: string
  description: string
  price: number
  category: string
  image: string
  status: string
  createdAt: string
  updatedAt: string
}

export async function getAllAds(): Promise<Ad[]> {
  try {
    const response = await fetch(`${API_URL}/ads`, {
      cache: 'no-store', // Always fetch fresh data
    })

    if (!response.ok) {
      throw new Error('Failed to fetch ads')
    }

    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error('Error fetching ads:', error)
    return []
  }
}

export async function getAdById(id: string): Promise<Ad | null> {
  try {
    const response = await fetch(`${API_URL}/ads/${id}`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch ad')
    }

    const data = await response.json()
    return data.data
  } catch (error) {
    console.error('Error fetching ad:', error)
    return null
  }
}
