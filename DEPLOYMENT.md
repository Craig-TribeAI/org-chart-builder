# Deploying to Railway.app

This guide will help you deploy the Org Chart Builder to Railway.app so your team can access it.

## Prerequisites

- A Railway.app account (free tier available)
- A GitHub account
- Git installed on your computer

## Step 1: Initialize Git Repository

If you haven't already, initialize a git repository in this project:

```bash
cd /Users/craigbarowsky/tribe_org-chart-v3
git init
git add .
git commit -m "Initial commit - Org Chart Builder"
```

## Step 2: Push to GitHub

1. Go to GitHub.com and create a new repository (e.g., "tribe-org-chart")
2. Don't initialize it with README, .gitignore, or license (we already have these)
3. Copy the repository URL (e.g., `https://github.com/yourusername/tribe-org-chart.git`)
4. Push your code:

```bash
git remote add origin https://github.com/yourusername/tribe-org-chart.git
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Railway

1. Go to [railway.app](https://railway.app) and log in
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway to access your GitHub account if needed
5. Select your `tribe-org-chart` repository
6. Railway will automatically detect it's a Node.js app and use the `railway.json` config

## Step 4: Wait for Deployment

- Railway will automatically:
  - Install dependencies (`npm install`)
  - Build the app (`npm run build`)
  - Start the server (`npm start`)
- This takes about 2-3 minutes

## Step 5: Access Your App

1. Once deployed, Railway will provide a public URL (e.g., `your-app.up.railway.app`)
2. Click on the URL to access your org chart
3. Share this URL with your team members

## Step 6: Configure Custom Domain (Optional)

If you want a custom domain:

1. Go to your Railway project settings
2. Click on "Domains"
3. Add your custom domain
4. Update your DNS settings as instructed by Railway

## Environment Variables (if needed in the future)

Currently, this app doesn't require environment variables, but if you need to add any:

1. Go to your Railway project
2. Click on "Variables"
3. Add key-value pairs

## Data Persistence

**Important Notes:**
- All org chart data is stored in the browser's localStorage
- Each user will have their own local copy
- To share org charts:
  - Export as JSON (Export button in the header)
  - Share the JSON file with team members
  - They can import it using the Import button

## Updating the Deployment

When you make changes:

```bash
git add .
git commit -m "Description of changes"
git push
```

Railway will automatically redeploy with your changes.

## Troubleshooting

### Build Failed
- Check the Railway logs for error messages
- Ensure all dependencies are in `package.json`
- Try running `npm run build` locally first

### App Won't Start
- Check Railway logs
- Ensure the `start` script in `package.json` is correct
- Verify the build created a `dist` folder

### Port Issues
- The app is configured to run on port 3000
- Railway automatically handles port mapping

## Support

For Railway-specific issues, check:
- [Railway Docs](https://docs.railway.app/)
- [Railway Discord](https://discord.gg/railway)
