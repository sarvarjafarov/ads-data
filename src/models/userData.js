const bcrypt = require('bcryptjs');

// In-memory user storage (replace with database in production)
let users = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@adsdata.com',
    password: bcrypt.hashSync('admin123', 10),
    role: 'admin',
    status: 'approved',
    companyName: 'AdsData Admin',
    createdAt: new Date().toISOString(),
  },
];

let nextId = 2;

module.exports = {
  // Get all users
  getAll: () => users,

  // Get user by ID
  getById: (id) => users.find((user) => user.id === parseInt(id)),

  // Get user by email
  getByEmail: (email) => users.find((user) => user.email === email),

  // Get user by username
  getByUsername: (username) => users.find((user) => user.username === username),

  // Get pending users
  getPending: () => users.filter((user) => user.status === 'pending'),

  // Create new user
  create: (userData) => {
    const newUser = {
      id: nextId++,
      ...userData,
      password: bcrypt.hashSync(userData.password, 10),
      role: userData.role || 'user',
      status: userData.status || 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    users.push(newUser);

    // Return user without password
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  },

  // Update user
  update: (id, userData) => {
    const index = users.findIndex((user) => user.id === parseInt(id));
    if (index === -1) return null;

    // If password is being updated, hash it
    if (userData.password) {
      userData.password = bcrypt.hashSync(userData.password, 10);
    }

    users[index] = {
      ...users[index],
      ...userData,
      id: users[index].id,
      updatedAt: new Date().toISOString(),
    };

    const { password, ...userWithoutPassword } = users[index];
    return userWithoutPassword;
  },

  // Delete user
  delete: (id) => {
    const index = users.findIndex((user) => user.id === parseInt(id));
    if (index === -1) return false;

    users.splice(index, 1);
    return true;
  },

  // Verify password
  verifyPassword: async (user, password) => {
    return await bcrypt.compare(password, user.password);
  },

  // Approve user
  approve: (id) => {
    const index = users.findIndex((user) => user.id === parseInt(id));
    if (index === -1) return null;

    users[index].status = 'approved';
    users[index].updatedAt = new Date().toISOString();

    const { password, ...userWithoutPassword } = users[index];
    return userWithoutPassword;
  },

  // Reject user
  reject: (id) => {
    const index = users.findIndex((user) => user.id === parseInt(id));
    if (index === -1) return null;

    users[index].status = 'rejected';
    users[index].updatedAt = new Date().toISOString();

    const { password, ...userWithoutPassword } = users[index];
    return userWithoutPassword;
  },
};
