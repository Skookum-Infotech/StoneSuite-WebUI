# OAuth Authentication Setup Guide

This document provides step-by-step instructions for setting up Microsoft Entra ID and AWS Cognito OAuth authentication for the StoneSuite application.

---

## Table of Contents

1. [Microsoft Entra ID Setup](#microsoft-entra-id-setup)
2. [AWS Cognito Setup](#aws-cognito-setup)
3. [Testing with Postman](#testing-with-postman)
4. [Environment Configuration](#environment-configuration)
5. [Troubleshooting](#troubleshooting)

---

## Microsoft Entra ID Setup

### Step 1: Create an App Registration in Azure

1. Go to [Azure Portal](https://portal.azure.com)
2. Search for **App registrations** and click on it
3. Click **+ New registration**
4. Fill in the following details:
   - **Name**: StoneSuite App
   - **Supported account types**: Select appropriate option (e.g., "Accounts in this organizational directory only")
   - **Redirect URI**: Select **Web** and enter `http://localhost:5000/api/auth/entra/callback`
5. Click **Register**

### Step 2: Get Your Credentials

1. On the app overview page, copy the **Application (client) ID** - this is your `ENTRA_ID_CLIENT_ID`
2. Go to **Certificates & secrets** → **Client secrets** → **+ New client secret**
3. Fill in the description and expiration
4. Click **Add** and copy the secret value - this is your `ENTRA_ID_CLIENT_SECRET`

### Step 3: Configure API Permissions

1. Go to **API permissions**
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Search for and select:
   - `User.Read`
   - `email`
   - `profile`
   - `openid`
6. Click **Add permissions**

### Step 4: Update Environment Variables

Add to your `backend/.env`:

```env
ENTRA_ID_CLIENT_ID=your-application-client-id
ENTRA_ID_CLIENT_SECRET=your-client-secret-value
ENTRA_ID_REDIRECT_URI=http://localhost:5000/api/auth/entra/callback
```

For production, update `ENTRA_ID_REDIRECT_URI` to your production domain:
```env
ENTRA_ID_REDIRECT_URI=https://your-production-domain.com/api/auth/entra/callback
```

---

## AWS Cognito Setup

### Step 1: Create a User Pool

1. Go to [AWS Cognito Console](https://console.aws.amazon.com/cognito)
2. Click **Create user pool**
3. Configure sign-in options:
   - Select **Email** as a sign-in option
   - Click **Next**
4. Configure password policy and other settings as needed
5. Review and create the user pool

### Step 2: Create an App Client

1. In your User Pool, go to **App integration** → **App clients**
2. Click **Create an app client**
3. Configure:
   - **App client name**: StoneSuite Frontend
   - **Client secret**: Check "Generate a client secret"
   - **Authentication flows**: Enable "Authorization code grant"
   - **Allowed callback URLs**: `http://localhost:5000/api/auth/cognito/callback`
   - **Allowed logout URLs**: `http://localhost:5173` (frontend)
   - **Allowed OAuth Scopes**: Select `openid`, `profile`, `email`
   - **Allowed OAuth flows**: Check "Authorization code grant"
4. Click **Create app client**

### Step 3: Get Your Credentials

1. Copy the **App client ID** - this is your `COGNITO_CLIENT_ID`
2. Click "Show Details" to see the **App client secret** - this is your `COGNITO_CLIENT_SECRET`
3. Go to **App integration** → **Domain name**
4. Set up or view your domain (e.g., `my-app.auth.us-east-1.amazoncognito.com`) - this is your `COGNITO_DOMAIN`

### Step 4: Update Environment Variables

Add to your `backend/.env`:

```env
COGNITO_CLIENT_ID=your-app-client-id
COGNITO_CLIENT_SECRET=your-app-client-secret
COGNITO_DOMAIN=my-app.auth.us-east-1.amazoncognito.com
COGNITO_REDIRECT_URI=http://localhost:5000/api/auth/cognito/callback
```

For production, update `COGNITO_REDIRECT_URI`:
```env
COGNITO_REDIRECT_URI=https://your-production-domain.com/api/auth/cognito/callback
```

**Also add to your `frontend/.env`**:

```env
VITE_COGNITO_CLIENT_ID=your-app-client-id
VITE_COGNITO_DOMAIN=my-app.auth.us-east-1.amazoncognito.com
```

---

## Environment Configuration

### Backend Configuration

Create a `backend/.env` file based on `.env.example`:

```env
PORT=5000
JWT_SECRET=your-secure-secret-key
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:5173

ENTRA_ID_CLIENT_ID=your-entra-id-client-id
ENTRA_ID_CLIENT_SECRET=your-entra-id-client-secret
ENTRA_ID_REDIRECT_URI=http://localhost:5000/api/auth/entra/callback

COGNITO_CLIENT_ID=your-cognito-client-id
COGNITO_CLIENT_SECRET=your-cognito-client-secret
COGNITO_DOMAIN=your-domain.auth.us-east-1.amazoncognito.com
COGNITO_REDIRECT_URI=http://localhost:5000/api/auth/cognito/callback
```

### Frontend Configuration

Create a `frontend/.env` file:

```env
VITE_API_BASE_URL=http://localhost:5000
VITE_ENTRA_CLIENT_ID=your-entra-id-client-id
VITE_COGNITO_CLIENT_ID=your-cognito-client-id
VITE_COGNITO_DOMAIN=your-domain.auth.us-east-1.amazoncognito.com
```

---

## Testing with Postman

### 1. Test Email/Password Login

**Request:**
```
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "rememberMe": false
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful.",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "fullName": "User Name",
    "createdAt": "2026-05-20T10:30:00Z"
  }
}
```

### 2. Test Entra ID OAuth

**Step 1: Get Authorization Code**
- Open browser and navigate to:
```
https://login.microsoftonline.com/common/oauth2/v2.0/authorize?
  client_id=YOUR_CLIENT_ID&
  redirect_uri=http://localhost:5000/api/auth/entra/callback&
  response_type=code&
  scope=openid profile email
```

**Step 2: Call Callback Endpoint**
```
GET http://localhost:5000/api/auth/entra/callback?code=<code_from_step1>
```

### 3. Test AWS Cognito OAuth

**Step 1: Get Authorization Code**
- Open browser and navigate to:
```
https://YOUR_DOMAIN/oauth2/authorize?
  client_id=YOUR_CLIENT_ID&
  redirect_uri=http://localhost:5000/api/auth/cognito/callback&
  response_type=code&
  scope=openid profile email
```

**Step 2: Call Callback Endpoint**
```
GET http://localhost:5000/api/auth/cognito/callback?code=<code_from_step1>
```

### 4. Test Protected Endpoint

**Request:**
```
GET http://localhost:5000/api/auth/me
Authorization: Bearer <jwt_token_from_login>
```

**Expected Response:**
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "fullName": "User Name",
    "createdAt": "2026-05-20T10:30:00Z"
  }
}
```

---

## Troubleshooting

### Common Issues

#### 1. "Redirect URI mismatch" error
- **Cause**: The redirect URI in your OAuth provider doesn't match your backend config
- **Solution**: Ensure the redirect URIs match exactly, including protocol, domain, and path

#### 2. "Invalid client_id" error
- **Cause**: Client ID is incorrect or from wrong OAuth provider
- **Solution**: Double-check the Client ID in your OAuth provider console

#### 3. CORS errors in browser console
- **Cause**: Frontend is not allowed to make requests to backend
- **Solution**: Ensure `CORS_ORIGIN` in backend .env matches your frontend URL

#### 4. "Failed to authenticate with Entra ID" error
- **Cause**: Usually due to incorrect client secret or invalid permissions
- **Solution**: 
  - Verify client secret is correct
  - Check API permissions include `User.Read` and email/profile scopes
  - Ensure app registration is in correct Azure tenant

#### 5. "Failed to authenticate with AWS Cognito" error
- **Cause**: Client secret might be incorrect or app client not properly configured
- **Solution**:
  - Verify Client ID and Secret are correct
  - Check that app client has "Authorization code grant" flow enabled
  - Confirm callback URL is in "Allowed callback URLs"
  - Check that app client has OAuth scopes: `openid`, `profile`, `email`

### Debug Mode

To enable more verbose logging, add this to your backend main.go temporarily:

```go
log.SetFlags(log.LstdFlags | log.Lshortfile)
```

---

## Architecture Overview

### Authentication Flow

```
Frontend (Login Page)
    ↓
[User clicks "Login with Entra ID/Cognito"]
    ↓
OAuth Provider (Entra ID/Cognito)
    ↓
[User authenticates with provider]
    ↓
OAuth Provider redirects to Backend Callback
    ↓
Backend exchanges code for token
    ↓
Backend fetches user info from OAuth provider
    ↓
Backend upserts user in local database
    ↓
Backend generates JWT token
    ↓
Backend returns token to frontend
    ↓
Frontend stores token and redirects to dashboard
```

### Database Schema

Users created via OAuth are stored with the following additional fields:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "fullName": "User Name",
  "oauthProvider": "entra_id" | "cognito",
  "oauthId": "external-provider-id",
  "createdAt": "2026-05-20T10:30:00Z",
  "updatedAt": "2026-05-20T10:30:00Z"
}
```

---

## Production Deployment

### Important Security Considerations

1. **Never commit secrets**: Always use environment variables, not hardcoded values
2. **Update redirect URIs**: Change all `localhost` URLs to your production domain
3. **Use HTTPS**: All OAuth redirects must use HTTPS in production
4. **Rotate secrets regularly**: Periodically generate new client secrets
5. **Secure JWT secret**: Use a strong, randomly generated JWT secret (min 32 characters)

### Deployment Checklist

- [ ] Update all redirect URIs in OAuth provider consoles
- [ ] Generate new client secrets for production
- [ ] Update `.env` with production values
- [ ] Ensure CORS_ORIGIN is set to production frontend URL
- [ ] Update JWT_SECRET to a strong random value
- [ ] Enable HTTPS on both frontend and backend
- [ ] Test complete authentication flow in production
- [ ] Set up error logging and monitoring
- [ ] Backup your OAuth provider configurations

---

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review provider documentation:
   - [Microsoft Entra ID](https://learn.microsoft.com/en-us/entra/identity-platform/)
   - [AWS Cognito](https://docs.aws.amazon.com/cognito/)
3. Check backend logs with `log` output
4. Verify all environment variables are correctly set
