# Heroku Deployment Guide

## Prerequisites
- Heroku CLI installed
- Git repository initialized
- Heroku account created

## Step-by-Step Deployment

### 1. Install Heroku CLI
```bash
# On macOS
brew tap heroku/brew && brew install heroku

# On Windows (with chocolatey)
choco install heroku-cli

# On Ubuntu
sudo snap install --classic heroku
```

### 2. Login to Heroku
```bash
heroku login
```

### 3. Create Heroku Application
```bash
# Create new app
heroku create your-cgpa-calculator-app

# Or with specific region
heroku create your-cgpa-calculator-app --region eu
```

### 4. Add MongoDB Atlas (Recommended)
```bash
# Option 1: MongoDB Atlas (Free tier available)
# Sign up at https://www.mongodb.com/atlas
# Get connection string and add to Heroku config

# Option 2: Heroku MongoDB addon
heroku addons:create mongolab:sandbox
```

### 5. Set Environment Variables
```bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_super_secure_production_secret
heroku config:set JWT_EXPIRE=7d

# If using MongoDB Atlas
heroku config:set MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/cgpa_calculator"

# If using Heroku addon
# MONGODB_URI will be set automatically
```

### 6. Configure Package.json for Heroku
The package.json is already configured with heroku-postbuild script.

### 7. Deploy
```bash
# Add Heroku remote
heroku git:remote -a your-cgpa-calculator-app

# Deploy
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

### 8. Open Application
```bash
heroku open
```

### 9. View Logs (if needed)
```bash
heroku logs --tail
```

## Environment Configuration

### Production Environment Variables
```bash
# Required
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=very_secure_random_string_here
heroku config:set MONGODB_URI=your_mongodb_connection_string

# Optional
heroku config:set JWT_EXPIRE=7d
heroku config:set PORT=5000  # Heroku sets this automatically
```

## MongoDB Atlas Setup (Recommended)

### 1. Create MongoDB Atlas Account
- Go to https://www.mongodb.com/atlas
- Sign up for free account
- Create a new cluster (M0 is free)

### 2. Configure Network Access
- Go to Network Access
- Add IP Address: 0.0.0.0/0 (Allow access from anywhere)

### 3. Create Database User
- Go to Database Access
- Create new user with read/write permissions

### 4. Get Connection String
- Go to Clusters → Connect → Connect your application
- Copy the connection string
- Replace `<password>` with your user password

### 5. Add to Heroku
```bash
heroku config:set MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/cgpa_calculator?retryWrites=true&w=majority"
```

## Custom Domain (Optional)

### 1. Add Custom Domain
```bash
heroku domains:add www.yourcustomdomain.com
```

### 2. Configure DNS
Point your domain's CNAME to the Heroku app URL.

## SSL Certificate (Automatic)
Heroku provides automatic SSL certificates for custom domains.

## Monitoring and Scaling

### View Application Info
```bash
heroku info
```

### Scale Dynos
```bash
# Scale to 2 web dynos
heroku ps:scale web=2

# Scale back to 1 (free tier)
heroku ps:scale web=1
```

### Monitor Performance
```bash
# View metrics
heroku logs --tail

# View performance metrics in dashboard
heroku addons:create librato:development
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check build logs
   heroku logs --tail
   
   # Clear build cache
   heroku repo:purge_cache
   ```

2. **Database Connection Issues**
   ```bash
   # Verify MongoDB URI
   heroku config:get MONGODB_URI
   
   # Test connection locally
   node -e "console.log(process.env.MONGODB_URI)"
   ```

3. **Frontend Not Loading**
   - Ensure `heroku-postbuild` script runs
   - Check if build folder is created
   - Verify static file serving in server.js

### Useful Commands
```bash
# Restart application
heroku restart

# Open bash shell
heroku run bash

# View configuration
heroku config

# Check dyno status
heroku ps
```

## Cost Optimization

### Free Tier Limitations
- App sleeps after 30 minutes of inactivity
- 550-1000 free dyno hours per month
- MongoDB Atlas M0 cluster (512MB storage)

### Preventing App Sleep
Use services like UptimeRobot to ping your app every 25 minutes.

## Security Checklist

- [ ] Use strong JWT_SECRET
- [ ] Enable MongoDB authentication
- [ ] Restrict MongoDB network access
- [ ] Use HTTPS (automatic with Heroku)
- [ ] Set proper CORS origins
- [ ] Enable rate limiting
- [ ] Use environment variables for secrets
- [ ] Regular dependency updates

## Backup Strategy

### MongoDB Atlas Automatic Backups
- Continuous backups available in M10+ clusters
- Point-in-time recovery
- Download backup files

### Manual Backup
```bash
# Export data
mongodump --uri="your_mongodb_uri"

# Import data
mongorestore --uri="your_mongodb_uri" dump/
```

Your CGPA Calculator is now live on Heroku! 🚀