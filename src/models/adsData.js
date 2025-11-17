// Simple in-memory data store (replace with database in production)
let ads = [
  {
    id: 1,
    title: 'Sample Ad 1',
    description: 'This is a sample ad',
    price: 99.99,
    category: 'Electronics',
    image: 'https://via.placeholder.com/300',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    title: 'Sample Ad 2',
    description: 'Another sample ad',
    price: 149.99,
    category: 'Fashion',
    image: 'https://via.placeholder.com/300',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let nextId = 3;

module.exports = {
  getAll: () => ads,
  getById: (id) => ads.find((ad) => ad.id === parseInt(id)),
  create: (adData) => {
    const newAd = {
      id: nextId++,
      ...adData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    ads.push(newAd);
    return newAd;
  },
  update: (id, adData) => {
    const index = ads.findIndex((ad) => ad.id === parseInt(id));
    if (index === -1) return null;

    ads[index] = {
      ...ads[index],
      ...adData,
      id: ads[index].id,
      updatedAt: new Date().toISOString(),
    };
    return ads[index];
  },
  delete: (id) => {
    const index = ads.findIndex((ad) => ad.id === parseInt(id));
    if (index === -1) return false;

    ads.splice(index, 1);
    return true;
  },
};
