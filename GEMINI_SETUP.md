# Google Gemini API Key Setup Guide

This guide walks you through setting up a Google Gemini API key for image comparison in your application.

## Step 1: Create or Select a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. If you don't have a project yet:
   - Click the project dropdown at the top
   - Click "New Project"
   - Enter a project name (e.g., "copy-compare-gemini")
   - Optionally select an organization
   - Click "Create"
3. If you already have a project, select it from the dropdown

## Step 2: Enable the Generative AI API

1. In your project, go to **APIs & Services** > **Library**
2. Search for "**Generative Language API**" (or "Generative AI API")
3. Click on the result
4. Click the **"Enable"** button
5. Wait for the API to be enabled (usually takes a few seconds)

**Note:** You might also see "Vertex AI API" - you don't need that for the Generative AI SDK we're using.

## Step 3: Create an API Key

1. Go to **APIs & Services** > **Credentials**
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"API key"**
4. A popup will appear with your new API key
5. **Copy the API key immediately** - you won't be able to see it again in full
6. Click "Close" (don't restrict it yet - we'll do that next)

## Step 4: (Recommended) Restrict the API Key

For security, restrict your API key to only the Generative Language API:

1. In **APIs & Services** > **Credentials**, find your API key
2. Click on the API key name to edit it
3. Under **"API restrictions"**:
   - Select **"Restrict key"**
   - Check only **"Generative Language API"**
   - Click "Save"
4. Under **"Application restrictions"** (optional but recommended):
   - You can restrict by IP address, HTTP referrer, or Android/iOS app
   - For server-side use, consider restricting by IP if you have a static IP
   - Click "Save"

## Step 5: Set Up Billing (Required)

**Important:** The Gemini API requires billing to be enabled, even for free tier usage.

1. Go to **Billing** in the left sidebar
2. If you don't have a billing account:
   - Click "Link a billing account"
   - Follow the prompts to add a payment method
3. Link your project to the billing account if not already linked

**Free Tier:** Google provides a generous free tier for Gemini API:
- 15 requests per minute (RPM)
- 1 million tokens per minute (TPM)
- Free tier is usually sufficient for development and moderate usage

## Step 6: Add the API Key to Your Project

1. Open your `.env.local` file (create it if it doesn't exist)
2. Add the following line:

```bash
GOOGLE_GEMINI_API_KEY=your_api_key_here
```

Replace `your_api_key_here` with the actual API key you copied in Step 3.

3. Save the file
4. **Important:** Make sure `.env.local` is in your `.gitignore` file to avoid committing your API key

## Step 7: Verify the Setup

1. Restart your Next.js development server:
   ```bash
   npm run dev
   ```

2. Try uploading an image in your application
3. Check the browser console and server logs for any errors
4. If you see "Gemini API key is not configured" warnings, double-check:
   - The environment variable name is exactly `GOOGLE_GEMINI_API_KEY`
   - The API key is correct (no extra spaces)
   - You've restarted the dev server after adding the key

## Troubleshooting

### "API key not valid" error
- Verify the API key is correct in `.env.local`
- Check that the Generative Language API is enabled
- Ensure billing is enabled on your project

### "Quota exceeded" error
- Check your usage in Google Cloud Console > APIs & Services > Dashboard
- You may have exceeded the free tier limits
- Consider upgrading your quota if needed

### "Permission denied" error
- Verify the API key has access to Generative Language API
- Check that billing is properly set up

## Security Best Practices

1. **Never commit your API key to version control**
   - Ensure `.env.local` is in `.gitignore`
   - Use environment variables in production (Vercel, etc.)

2. **Restrict your API key** (as mentioned in Step 4)
   - Limit to only the APIs you need
   - Add application restrictions if possible

3. **Rotate keys regularly**
   - If a key is compromised, delete it and create a new one
   - Update your environment variables accordingly

4. **Monitor usage**
   - Set up billing alerts in Google Cloud Console
   - Review API usage regularly

## Production Deployment

When deploying to production (Vercel, etc.):

1. Go to your hosting platform's environment variables settings
2. Add `GOOGLE_GEMINI_API_KEY` with your API key value
3. Redeploy your application

For Vercel specifically:
- Go to your project settings
- Navigate to "Environment Variables"
- Add the variable for Production, Preview, and Development environments
- Redeploy

## Additional Resources

- [Google AI Studio](https://makersuite.google.com/app/apikey) - Alternative way to get an API key
- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Pricing Information](https://ai.google.dev/pricing)

