# API Contracts — StoneSuite

Base URL: `http://localhost:8080/api` (dev) | `VITE_API_BASE_URL` (configured per env)

All responses follow the standard envelope:
```json
{
  "success": true | false,
  "message": "Human-readable description",
  "token": "<jwt>",        // present on successful auth
  "user": { ... }          // present when user data is returned
}
```

---

## Auth — `/api/auth`

### GET /api
Health check / API info.

**Auth:** None

**Response 200**
```json
{
  "success": true,
  "message": "Welcome to the StoneSuite Go Authentication Backend API.",
  "version": "1.0.0"
}
```

---

### POST /api/auth/register
Create a new user account. Sends an email verification code.

**Auth:** None

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "minimum6chars",
  "fullName": "Jane Doe"
}
```

**Response 201** *(on success — TODO: confirm status code, currently may be 200)*
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account."
}
```

**Errors**
| Status | Condition |
|--------|-----------|
| 400 | Missing email or password |
| 400 | Invalid email format |
| 400 | Password < 6 characters |
| 409 | Email already registered |
| 405 | Non-POST method |

---

### POST /api/auth/login
Authenticate with email + password. Returns a signed JWT.

**Auth:** None

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "yourpassword",
  "rememberMe": false
}
```

**Response 200**
```json
{
  "success": true,
  "message": "Login successful.",
  "token": "<jwt>",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "Jane Doe",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

**Errors**
| Status | Condition |
|--------|-----------|
| 400 | Missing email or password |
| 401 | Invalid credentials |
| 403 | Email not verified |
| 423 | Account locked (too many failed attempts) |
| 405 | Non-POST method |

---

### POST /api/auth/forgot-password
Initiate password reset. Sends a reset token to the user's email.

**Auth:** None

**Request Body**
```json
{
  "email": "user@example.com"
}
```

**Response 200** *(always 200 to prevent email enumeration)*
```json
{
  "success": true,
  "message": "If that email is registered, a reset link has been sent."
}
```

---

### POST /api/auth/reset-password
Set a new password using the reset token received via email.

**Auth:** None

**Request Body**
```json
{
  "token": "<reset-token-from-email>",
  "newPassword": "newpassword123"
}
```

**Response 200**
```json
{
  "success": true,
  "message": "Password has been reset successfully."
}
```

**Errors**
| Status | Condition |
|--------|-----------|
| 400 | Missing token or newPassword |
| 400 | Password < 6 characters |
| 400 | Token invalid or expired |

---

### POST /api/auth/verify-email
Confirm email address using a verification code sent at registration.

**Auth:** None

**Request Body**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Response 200**
```json
{
  "success": true,
  "message": "Email verified successfully."
}
```

**Errors**
| Status | Condition |
|--------|-----------|
| 400 | Missing email or code |
| 400 | Invalid or expired verification code |
| 409 | Email already verified |

---

### POST /api/auth/resend-verification
Re-send the email verification code.

**Auth:** None

**Request Body**
```json
{
  "email": "user@example.com"
}
```

**Response 200**
```json
{
  "success": true,
  "message": "Verification email resent."
}
```

**Errors**
| Status | Condition |
|--------|-----------|
| 400 | Missing email |
| 404 | Email not registered |
| 409 | Email already verified |

---

### GET /api/auth/me
Return the currently authenticated user's profile.

**Auth:** Required — `Authorization: Bearer <jwt>`

**Response 200**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "Jane Doe",
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

**Errors**
| Status | Condition |
|--------|-----------|
| 401 | No / invalid Authorization header |
| 401 | Token expired |

---

## OAuth — SSO Callbacks

### GET /api/auth/entra/callback
Microsoft Entra ID (Azure AD) OAuth callback. Called by the identity provider after user consent. Redirects browser to frontend with a JWT on success.

**Auth:** None (called by Azure AD)

**Query Params**
| Param | Description |
|-------|-------------|
| `code` | Authorization code from Azure |
| `state` | State parameter for CSRF protection |

**On success:** Issues a StoneSuite JWT, upserts the user into the local DB, then redirects to `FRONTEND_URL/auth/callback?token=<jwt>`.

**TODO:** Confirm the exact frontend redirect path and token delivery mechanism.

---

### GET /api/auth/cognito/callback
AWS Cognito OAuth callback. Called by the identity provider after user consent.

**Auth:** None (called by Cognito)

**Query Params**
| Param | Description |
|-------|-------------|
| `code` | Authorization code from Cognito |
| `state` | State parameter for CSRF protection |

**On success:** Issues a StoneSuite JWT, upserts the user, redirects to frontend.

---

## User Model (DB → JSON)

```go
// models.UserResponse  — safe for API exposure
type UserResponse struct {
    ID        string    `json:"id"`
    Email     string    `json:"email"`
    FullName  string    `json:"fullName"`
    CreatedAt time.Time `json:"createdAt"`
}
```

Fields intentionally **excluded** from API responses: `passwordHash`, `oauthProvider`, `oauthId`, `emailVerified`, `failedLoginAttempts`, `isLocked`, `lockedUntil`, `passwordResetToken`, `passwordResetExpiry`, `emailVerificationCode`.

---

## Error Response Shape
```json
{
  "success": false,
  "message": "Human-readable error description."
}
```
No structured error codes yet — error detail is in `message`. **TODO:** Add a machine-readable `code` field (e.g. `"INVALID_CREDENTIALS"`) for frontend i18n and error handling.
