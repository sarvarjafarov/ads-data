# Ads Data Backend API & CMS

A Node.js backend API with a complete Admin Panel CMS for managing ads data, built with Express.js.

## Features

- RESTful API architecture
- Express.js web framework
- **Full-featured Admin Panel CMS**
- **B2B User Registration System with Admin Approval**
- **User Management Dashboard**
- JWT-based authentication
- CRUD operations for ads management
- User approval workflow (pending, approved, rejected)
- Beautiful responsive UI
- CORS enabled
- Security headers with Helmet
- Request logging with Morgan
- Environment-based configuration
- Error handling middleware
- Health check endpoint

## Project Structure

```
ads-data/
├── public/              # Static files
│   ├── css/            # Stylesheets
│   │   └── style.css
│   ├── js/             # Client-side JavaScript
│   │   ├── admin.js
│   │   ├── login.js
│   │   └── register.js
│   ├── admin.html      # Admin dashboard (Ads & User Management)
│   ├── login.html      # Login page
│   └── register.html   # B2B registration page
├── src/
│   ├── config/         # Configuration files
│   ├── controllers/    # Request handlers
│   │   ├── adsController.js
│   │   ├── authController.js
│   │   └── userController.js
│   ├── middleware/     # Custom middleware (auth, error handling)
│   ├── models/         # Data models
│   │   ├── adsData.js
│   │   └── userData.js
│   ├── routes/         # API routes
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   └── adsRoutes.js
│   ├── utils/          # Utility functions
│   ├── app.js          # Express app setup
│   └── server.js       # Server entry point
├── .env.example        # Example environment variables
├── .gitignore
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/sarvarjafarov/ads-data.git
cd ads-data
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`:
```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*

# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRE=7d

# Admin Credentials (change in production!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### Running the Application

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `http://localhost:3000`

## Admin Panel (CMS)

### Accessing the Admin Panel

1. Open your browser and navigate to:
   ```
   http://localhost:3000/admin/login
   ```

2. Login with default credentials:
   - **Username:** admin
   - **Password:** admin123

3. After successful login, you'll be redirected to the admin dashboard where you can:
   - **Ads Management Tab:**
     - View all ads in a table format
     - Create new ads
     - Edit existing ads
     - Delete ads
     - Filter and manage ad status (active, inactive, draft)
   - **User Management Tab:**
     - View all registered B2B users
     - Approve pending user registrations
     - Reject user registrations
     - Filter users by status (all, pending, approved, rejected)
     - Delete users
     - Monitor user statistics

### Admin Panel Features

- **Authentication:** Secure JWT-based authentication
- **Dashboard:** Clean, modern interface with statistics and tabbed navigation
- **Ads Management:**
  - Complete CRUD operations
  - Image support for ads
  - Category organization (Electronics, Fashion, Home, etc.)
  - Status management (active, inactive, draft)
- **User Management:**
  - B2B user approval workflow
  - View pending registrations
  - Approve/reject users
  - User filtering by status
  - Delete user accounts
  - Protected admin account
- **Responsive Design:** Works on desktop, tablet, and mobile devices

## B2B User Registration

### For New Users

1. Navigate to the registration page:
   ```
   http://localhost:3000/register
   ```

2. Fill out the registration form with:
   - Username
   - Business Email
   - Password
   - Company Name
   - Contact Person (optional)
   - Phone Number (optional)

3. After submitting, your account will be created with **pending** status

4. Wait for admin approval before you can login

### User Registration Flow

1. **User Registers** → Status: `pending`
2. **Admin Reviews** → Admin can approve or reject
3. **User Approved** → Status: `approved` → User can now login
4. **User Rejected** → Status: `rejected` → User cannot login

### Login Restrictions

- Users with `pending` status will see: "Your account is pending approval"
- Users with `rejected` status will see: "Your account has been rejected"
- Only `approved` users can access the system

## API Endpoints

### Health Check
- `GET /api/health` - Check server health status

### Authentication
- `POST /api/auth/register` - Register new B2B user (creates user with pending status)
- `POST /api/auth/login` - Login and get JWT token (checks approval status)
- `POST /api/auth/logout` - Logout (requires authentication)
- `GET /api/auth/me` - Get current user info (requires authentication)

### Public Ads Endpoints
- `GET /api/ads` - Get all ads
- `GET /api/ads/:id` - Get ad by ID
- `POST /api/ads` - Create new ad
- `PUT /api/ads/:id` - Update ad by ID
- `DELETE /api/ads/:id` - Delete ad by ID

### Admin Endpoints (Require Authentication)

**Ads Management:**
- `GET /api/admin/ads` - Get all ads (admin)
- `GET /api/admin/ads/:id` - Get ad by ID (admin)
- `POST /api/admin/ads` - Create new ad (admin)
- `PUT /api/admin/ads/:id` - Update ad by ID (admin)
- `DELETE /api/admin/ads/:id` - Delete ad by ID (admin)

**User Management:**
- `GET /api/admin/users` - Get all users (admin)
- `GET /api/admin/users/pending` - Get pending users (admin)
- `GET /api/admin/users/:id` - Get user by ID (admin)
- `POST /api/admin/users/:id/approve` - Approve user (admin)
- `POST /api/admin/users/:id/reject` - Reject user (admin)
- `DELETE /api/admin/users/:id` - Delete user (admin)

## Example API Requests

### Get Health Status
```bash
curl http://localhost:3000/api/health
```

### Register New B2B User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@company.com",
    "password": "securepass123",
    "companyName": "Acme Corp",
    "contactPerson": "John Doe",
    "phone": "+1234567890"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

### Approve User (Admin)
```bash
curl -X POST http://localhost:3000/api/admin/users/USER_ID/approve \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Pending Users (Admin)
```bash
curl http://localhost:3000/api/admin/users/pending \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Create Ad (Authenticated)
```bash
curl -X POST http://localhost:3000/api/admin/ads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Sample Ad",
    "description": "This is a sample ad",
    "price": 99.99,
    "category": "Electronics",
    "status": "active"
  }'
```

### Get All Ads
```bash
curl http://localhost:3000/api/ads
```

### Update Ad (Authenticated)
```bash
curl -X PUT http://localhost:3000/api/admin/ads/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"title": "Updated Ad", "price": 149.99}'
```

### Delete Ad (Authenticated)
```bash
curl -X DELETE http://localhost:3000/api/admin/ads/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Development

### Adding New Routes

1. Create a controller in `src/controllers/`
2. Create a route file in `src/routes/`
3. Register the route in `src/routes/index.js`

### Error Handling

All errors are handled by the error handling middleware in `src/middleware/errorHandler.js`. Errors will return JSON responses with appropriate status codes.

## Security Notes

⚠️ **IMPORTANT:** Before deploying to production:

1. Change the `JWT_SECRET` in `.env` to a strong, random string
2. Update admin credentials (`ADMIN_USERNAME` and `ADMIN_PASSWORD`)
3. Set `NODE_ENV=production`
4. Configure `CORS_ORIGIN` to your frontend domain
5. Use HTTPS in production
6. Consider adding rate limiting
7. Implement proper password hashing for multiple users

## Current Data Storage

The application currently uses **in-memory storage** for demonstration purposes. All data will be lost when the server restarts.

### Next Steps for Production

- Add database integration (MongoDB, PostgreSQL, MySQL, etc.)
- ✅ ~~Implement proper user management system~~ (Completed: B2B registration with approval workflow)
- Add file upload for images
- Add input validation and sanitization
- Add email notifications for user approval/rejection
- Write unit and integration tests
- Add API documentation (Swagger/OpenAPI)
- Implement rate limiting
- Add caching layer
- Set up logging and monitoring
- Add password reset functionality
- Implement two-factor authentication (2FA)

## License

ISC
