# Migration Guide: SQLite to Supabase

This guide will help you migrate your attendance management system from SQLite to Supabase for deployment on Vercel.

## Prerequisites

1. A Supabase account (sign up at [supabase.com](https://supabase.com))
2. A Vercel account (sign up at [vercel.com](https://vercel.com))
3. Your existing SQLite database with data

## Step 1: Set up Supabase

1. **Create a new Supabase project:**
   - Go to [supabase.com](https://supabase.com) and create a new project
   - Choose a name and region for your project
   - Wait for the project to be created

2. **Get your Supabase credentials:**
   - Go to Settings → API in your Supabase dashboard
   - Copy your anon/public key
   - Save this for later use
   - Your project URL is already configured: `https://pxyklohssmbrngkhomxw.supabase.co`

3. **Create the database schema:**
   - Go to the SQL Editor in your Supabase dashboard
   - Copy and paste the contents of `supabase-schema.sql`
   - Run the SQL to create the tables

## Step 2: Configure Environment Variables

1. **Create a `.env` file in your project root:**
   ```bash
   cp env.example .env
   ```

2. **Fill in your Supabase credentials:**
   ```
   SUPABASE_KEY=your_supabase_anon_key
   ADMIN_PIN=your_admin_pin
   ```

## Step 3: Migrate Your Data

1. **Run the migration script:**
   ```bash
   npm run migrate
   ```

   This will:
   - Connect to your existing SQLite database
   - Export all players and attendance records
   - Import them into your Supabase database

2. **Verify the migration:**
   - Check your Supabase dashboard to confirm the data was imported
   - The script will also print a summary of migrated records

## Step 4: Test Locally

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Test the application:**
   - Open http://localhost:5173
   - Verify that players and attendance data are loading correctly
   - Test time-in/time-out functionality
   - Test admin functions

## Step 5: Deploy to Vercel

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Migrate to Supabase"
   git push origin main
   ```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will automatically detect the project configuration

3. **Set environment variables in Vercel:**
   - Go to your project settings in Vercel
   - Add the following environment variables:
     - `SUPABASE_KEY`: Your Supabase anon key
     - `ADMIN_PIN`: Your admin PIN (optional)
     - `VITE_API_URL`: Your Vercel deployment URL (will be set automatically)

4. **Redeploy:**
   - Vercel will automatically redeploy when you add environment variables
   - Or manually trigger a redeploy from the dashboard

## Step 6: Update Frontend Configuration

The frontend is already configured to use environment variables. In production, Vercel will automatically set `VITE_API_URL` to your deployment URL.

## Troubleshooting

### Common Issues:

1. **"Missing Supabase environment variable" error:**
   - Make sure your `.env` file is in the project root
   - Verify the `SUPABASE_KEY` variable is set correctly

2. **Migration fails:**
   - Check that your SQLite database exists at `server/attendance.db`
   - Verify your Supabase credentials are correct
   - Check the Supabase dashboard for any error messages

3. **Frontend can't connect to API:**
   - Verify `VITE_API_URL` is set correctly
   - Check that your Vercel deployment is successful
   - Ensure the API routes are working in the Vercel deployment

4. **Database connection issues:**
   - Check your Supabase project status
   - Verify your API keys are correct
   - Check the Supabase logs for any errors

### Getting Help:

- Check the Supabase documentation: [supabase.com/docs](https://supabase.com/docs)
- Check the Vercel documentation: [vercel.com/docs](https://vercel.com/docs)
- Review the application logs in both Supabase and Vercel dashboards

## Post-Migration Cleanup

After successful migration and deployment:

1. **Backup your SQLite database** (keep it as a backup)
2. **Test all functionality** in the production environment
3. **Update any documentation** with new deployment URLs
4. **Consider removing SQLite dependencies** if no longer needed

## Security Notes

- Never commit your `.env` file to version control
- Use strong, unique admin PINs
- Regularly rotate your Supabase API keys
- Monitor your Supabase usage and costs
- Enable Row Level Security (RLS) policies as needed for your use case

Your attendance management system is now ready for production deployment with Supabase!
