# Enabling Gemini 2.5 Flash (Paid Tier) Setup Guide

To use `gemini-2.0-flash-exp` or `gemini-2.5-flash` (experimental models), you need to enable paid tier access for the Generative AI API.

## Step 1: Enable Billing (Required)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one)
3. Navigate to **Billing** in the left sidebar
4. If you don't have a billing account:
   - Click **"Link a billing account"**
   - Follow the prompts to add a payment method (credit card)
   - Complete the billing setup
5. Ensure your project is linked to the billing account

## Step 2: Enable Generative Language API

1. In Google Cloud Console, go to **APIs & Services** > **Library**
2. Search for **"Generative Language API"**
3. Click on it and click **"Enable"**
4. Wait for it to be enabled (usually instant)

## Step 3: Check API Quotas

1. Go to **APIs & Services** > **Quotas**
2. Search for "Generative Language API"
3. Look for quotas related to:
   - `generate_content_free_tier_requests`
   - `generate_content_free_tier_input_token_count`
4. These should show limits for the free tier

**Note:** Experimental models like `gemini-2.0-flash-exp` have a limit of 0 on the free tier. Once billing is enabled, you'll have access to paid tier quotas.

## Step 4: Verify API Key Has Access

1. Go to **APIs & Services** > **Credentials**
2. Find your API key
3. Click on it to edit
4. Under **"API restrictions"**, ensure:
   - Either "Don't restrict key" is selected, OR
   - "Restrict key" is selected and **"Generative Language API"** is checked
5. Save changes

## Step 5: Wait for Quota Propagation

After enabling billing, it may take a few minutes (up to 15 minutes) for the paid tier quotas to become active. You can check your quota status at:
- https://ai.dev/usage?tab=rate-limit

## Step 6: Update Your Code

Once billing is enabled, update the model name in your code. The available models are:

- `gemini-2.0-flash-exp` - Experimental, requires paid tier
- `gemini-1.5-flash` - Stable, free tier available
- `gemini-1.5-pro` - Stable, free tier available

**Note:** As of now, there may not be a `gemini-2.5-flash` model. The latest experimental is `gemini-2.0-flash-exp`. Check the [Gemini API documentation](https://ai.google.dev/gemini-api/docs/models/gemini) for the latest model names.

## Pricing

Once billing is enabled, you'll be charged for usage beyond the free tier. Check current pricing at:
- https://ai.google.dev/pricing

The free tier typically includes:
- 15 requests per minute
- 1 million tokens per minute

Paid tier pricing is usually very affordable (often $0.0001-0.001 per 1K tokens).

## Troubleshooting

### Still Getting "Quota Exceeded" Errors?

1. **Wait 15 minutes** - Quota changes can take time to propagate
2. **Check billing status** - Ensure billing is actually enabled and active
3. **Verify API key** - Make sure your API key is from the project with billing enabled
4. **Check quotas page** - Go to APIs & Services > Quotas and verify paid tier quotas are available
5. **Try a different model** - Test with `gemini-1.5-flash` first to ensure API access works

### Model Not Found Errors?

- Verify the exact model name in the [Gemini API documentation](https://ai.google.dev/gemini-api/docs/models/gemini)
- Model names are case-sensitive
- Experimental models may be renamed or deprecated

## Alternative: Use Vertex AI

If you prefer using Vertex AI instead of the Generative AI API:
1. Enable **Vertex AI API** instead
2. Use different authentication (service account keys)
3. Different model naming conventions
4. More enterprise-focused features

For most use cases, the Generative AI API (what we're using) is simpler and sufficient.

