# GitHub Pages Deployment Guide

## Overview
Deploy the React frontend to GitHub Pages and backend to a cloud service.

## Frontend Deployment (GitHub Pages)

### 1. Configure Frontend for GitHub Pages

#### Update client/package.json
```json
{
  "homepage": "https://yourusername.github.io/cgpa-calculator",
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d build"
  },
  "devDependencies": {
    "gh-pages": "^4.0.0"
  }
}
```

#### Install gh-pages
```bash
cd client
npm install --save-dev gh-pages
```

### 2. Configure Environment Variables

#### Create client/.env.production
```env
REACT_APP_API_URL=https://your-backend-app.herokuapp.com
REACT_APP_ENVIRONMENT=production
```

#### Create client/.env.development
```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_ENVIRONMENT=development
```

### 3. Update API Base URL

#### Create client/src/config/api.js
```javascript
const config = {
  apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  environment: process.env.REACT_APP_ENVIRONMENT || 'development'
};

export default config;
```

#### Update axios calls
```javascript
// In client/src/contexts/AuthContext.js
import config from '../config/api';

// Replace localhost URLs with:
const response = await axios.get(`${config.apiUrl}/api/auth/me`);
```

### 4. Deploy Frontend

#### Manual Deployment
```bash
cd client
npm run deploy
```

#### Automatic Deployment (GitHub Actions)
The GitHub Actions workflow is already configured in `.github/workflows/deploy.yml`

### 5. Enable GitHub Pages
1. Go to repository Settings
2. Scroll to "Pages" section
3. Source: Deploy from a branch
4. Branch: gh-pages
5. Folder: / (root)

## Backend Deployment Options

### Option 1: Heroku (Recommended)
Follow the Heroku deployment guide in `deploy-guides/heroku-deployment.md`

### Option 2: Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
railway deploy
```

### Option 3: Render
1. Connect GitHub repository to Render
2. Create new Web Service
3. Build Command: `npm install && cd client && npm install && npm run build`
4. Start Command: `npm start`

### Option 4: Vercel (Serverless)
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

## Complete Deployment Steps

### 1. Repository Setup
```bash
# Initialize git repository
git init
git add .
git commit -m "Initial commit"

# Create GitHub repository and push
git remote add origin https://github.com/yourusername/cgpa-calculator.git
git branch -M main
git push -u origin main
```

### 2. Backend Deployment (Heroku)
```bash
# Create Heroku app
heroku create your-cgpa-calculator-api

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_secure_secret
heroku config:set MONGODB_URI=your_mongodb_connection_string

# Deploy backend
git push heroku main
```

### 3. Frontend Configuration
```bash
# Update frontend API URL
echo "REACT_APP_API_URL=https://your-cgpa-calculator-api.herokuapp.com" > client/.env.production

# Add homepage to package.json
cd client
npm install --save-dev gh-pages
```

### 4. Frontend Deployment
```bash
# Deploy to GitHub Pages
cd client
npm run deploy
```

### 5. Custom Domain (Optional)

#### For GitHub Pages
1. Add CNAME file in client/public/CNAME:
   ```
   your-domain.com
   ```
2. Configure DNS A records to point to GitHub Pages IPs

#### For Backend
Use Heroku custom domains or your hosting provider's domain settings.

## Environment Variables Setup

### Frontend (.env.production)
```env
REACT_APP_API_URL=https://your-backend-domain.com
REACT_APP_ENVIRONMENT=production
REACT_APP_APP_NAME=CGPA Calculator
```

### Backend (Heroku Config)
```bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_very_secure_jwt_secret
heroku config:set JWT_EXPIRE=7d
heroku config:set MONGODB_URI=mongodb+srv://user:pass@cluster.net/cgpa_calculator
```

## CORS Configuration

Update server.js for production CORS:
```javascript
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourusername.github.io', 'https://your-custom-domain.com']
    : ['http://localhost:3000'],
  credentials: true
}));
```

## SSL/HTTPS Setup

### GitHub Pages
- Automatic HTTPS for github.io domains
- Custom domain HTTPS available

### Backend (Heroku)
- Automatic HTTPS for herokuapp.com domains
- Custom domain SSL certificates available

## Performance Optimization

### Frontend
```bash
# Build optimization
cd client
npm run build

# Bundle analysis
npm install --save-dev webpack-bundle-analyzer
npm run build && npx webpack-bundle-analyzer build/static/js/*.js
```

### Backend
- Enable gzip compression
- Use CDN for static assets
- Implement caching strategies
- Monitor performance with Heroku metrics

## Monitoring and Analytics

### Frontend
- Google Analytics integration
- Error tracking with Sentry
- Performance monitoring

### Backend
- Heroku metrics
- MongoDB Atlas monitoring
- Log aggregation
- Uptime monitoring

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check origin configuration
   - Verify API URL in frontend

2. **Build Failures**
   - Check Node.js version compatibility
   - Verify all dependencies are installed

3. **Database Connection**
   - Verify MongoDB URI
   - Check network access settings

4. **Environment Variables**
   - Ensure all required variables are set
   - Check variable names (REACT_APP_ prefix for frontend)

### Debugging Tools
```bash
# Check deployed frontend
curl -I https://yourusername.github.io/cgpa-calculator

# Check backend health
curl https://your-backend.herokuapp.com/api/health

# View deployment logs
heroku logs --tail
```

## Security Considerations

- Use HTTPS for all communications
- Implement proper CORS settings
- Use environment variables for secrets
- Enable rate limiting
- Regular security updates
- Input validation and sanitization

## Backup and Recovery

### Database Backups
- MongoDB Atlas automatic backups
- Manual export procedures
- Disaster recovery plan

### Code Backups
- Git repository (already backed up on GitHub)
- Branch protection rules
- Regular commits and tags

Your CGPA Calculator is now fully deployed and accessible worldwide! 🌐