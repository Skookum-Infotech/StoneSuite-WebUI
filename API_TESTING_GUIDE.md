# 🧪 Password Security & Email API Testing Guide

## 📌 Prerequisites

- Backend running on `http://localhost:8080`
- `.env` file configured with email settings
- Test user account created (or create one during testing)
- cURL or Postman for testing

---

## 🚀 Quick Start - Test All Features in 5 Minutes

```bash
# 1. Register a test user (if needed)
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123","fullName":"Test User"}'

# 2. Test account lockout (3 failed attempts)
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'

# 3. Request password reset
curl -X POST http://localhost:8080/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# 4. Check email for reset token (then use in next command)

# 5. Reset password with token
curl -X POST http://localhost:8080/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"YOUR_TOKEN_HERE","newPassword":"NewPass123"}'

# 6. Login with new password
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"NewPass123"}'
```

---

## 🔍 Detailed Testing Guide

### Test 1: Account Lockout (3-Strike Rule)

**Scenario**: User enters wrong password 3 times → account locks for 15 minutes

#### Step 1: Make First Failed Login Attempt
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrongpassword"}'
```

**Expected Response**:
```json
{
  "success": false,
  "message": "Login failed. Invalid email address or password."
}
```

**Expected Status**: `401 Unauthorized`

#### Step 2: Make Second Failed Login Attempt
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrongpassword"}'
```

**Expected Response**: Same as Step 1

#### Step 3: Make Third Failed Login Attempt
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrongpassword"}'
```

**Expected Response**: Same as Step 1

#### Step 4: Try Login While Locked
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"correctpassword"}'
```

**Expected Response**:
```json
{
  "success": false,
  "message": "Account is locked due to multiple failed login attempts. Please try again later or use password reset."
}
```

**Expected Status**: `401 Unauthorized`

---

### Test 2: Password Reset Flow

**Scenario**: User forgets password → requests reset → receives token → resets password

#### Step 1: Request Password Reset
```bash
curl -X POST http://localhost:8080/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

**Expected Status**: `200 OK`

**Action**: Check email inbox for reset token (look in terminal logs if email not configured)

#### Step 2: Reset Password with Token
```bash
curl -X POST http://localhost:8080/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "PASTE_TOKEN_FROM_EMAIL_HERE",
    "newPassword": "NewPassword123"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Password has been reset successfully. You can now log in with your new password."
}
```

**Expected Status**: `200 OK`

#### Step 3: Test New Password Works
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"NewPassword123"}'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Login successful.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-id",
    "email": "test@example.com",
    "fullName": "Test User",
    "createdAt": "2026-05-26T10:00:00Z"
  }
}
```

**Expected Status**: `200 OK`

---

### Test 3: Email Verification

**Scenario**: Send verification code → user verifies email

#### Step 1: Request Verification Code
```bash
curl -X POST http://localhost:8080/api/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "If an account exists with this email, a verification code has been sent."
}
```

**Expected Status**: `200 OK`

**Action**: Check email for 6-digit verification code (or check terminal logs)

#### Step 2: Verify Email with Code
```bash
curl -X POST http://localhost:8080/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "code": "123456"
  }'
```

**Expected Response** (with correct code):
```json
{
  "success": true,
  "message": "Email has been verified successfully."
}
```

**Expected Status**: `200 OK`

**Expected Response** (with wrong code):
```json
{
  "success": false,
  "message": "Invalid verification code."
}
```

**Expected Status**: `401 Unauthorized`

---

## 🧪 Edge Cases & Error Testing

### Test 4: Invalid Reset Token
```bash
curl -X POST http://localhost:8080/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "invalid-token",
    "newPassword": "NewPassword123"
  }'
```

**Expected Response**:
```json
{
  "success": false,
  "message": "Invalid or expired reset token."
}
```

**Expected Status**: `401 Unauthorized`

---

### Test 5: Weak Password
```bash
curl -X POST http://localhost:8080/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "valid-token",
    "newPassword": "123"
  }'
```

**Expected Response**:
```json
{
  "success": false,
  "message": "Password must be at least 6 characters long."
}
```

**Expected Status**: `400 Bad Request`

---

### Test 6: Empty Email Field
```bash
curl -X POST http://localhost:8080/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":""}'
```

**Expected Response**:
```json
{
  "success": false,
  "message": "Please provide a valid email address."
}
```

**Expected Status**: `400 Bad Request`

---

### Test 7: Invalid Email Format
```bash
curl -X POST http://localhost:8080/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email"}'
```

**Expected Response**:
```json
{
  "success": false,
  "message": "Please provide a valid email address."
}
```

**Expected Status**: `400 Bad Request`

---

## 📊 Complete Test Workflow with Postman

### 1. Create Postman Collection

**Collection Name**: StoneSuite Auth Testing

#### Request 1: Register User
- **Name**: Register Test User
- **Method**: POST
- **URL**: `http://localhost:8080/api/auth/register`
- **Headers**: 
  - `Content-Type: application/json`
- **Body** (JSON):
```json
{
  "email": "test@example.com",
  "password": "Password123",
  "fullName": "Test User"
}
```

#### Request 2: Failed Login (Attempt 1)
- **Name**: Failed Login Attempt 1
- **Method**: POST
- **URL**: `http://localhost:8080/api/auth/login`
- **Headers**: 
  - `Content-Type: application/json`
- **Body** (JSON):
```json
{
  "email": "test@example.com",
  "password": "wrongpassword",
  "rememberMe": false
}
```

#### Request 3: Failed Login (Attempt 2)
- **Name**: Failed Login Attempt 2
- Same as Request 2

#### Request 4: Failed Login (Attempt 3)
- **Name**: Failed Login Attempt 3
- Same as Request 2

#### Request 5: Try Login While Locked
- **Name**: Login While Locked
- **Method**: POST
- **URL**: `http://localhost:8080/api/auth/login`
- **Body**:
```json
{
  "email": "test@example.com",
  "password": "Password123",
  "rememberMe": false
}
```

#### Request 6: Forgot Password
- **Name**: Request Password Reset
- **Method**: POST
- **URL**: `http://localhost:8080/api/auth/forgot-password`
- **Body**:
```json
{
  "email": "test@example.com"
}
```

#### Request 7: Reset Password
- **Name**: Reset Password
- **Method**: POST
- **URL**: `http://localhost:8080/api/auth/reset-password`
- **Body**:
```json
{
  "token": "{{reset_token}}",
  "newPassword": "NewPassword123"
}
```

#### Request 8: Login with New Password
- **Name**: Login with New Password
- **Method**: POST
- **URL**: `http://localhost:8080/api/auth/login`
- **Body**:
```json
{
  "email": "test@example.com",
  "password": "NewPassword123",
  "rememberMe": false
}
```

#### Request 9: Resend Verification
- **Name**: Resend Email Verification
- **Method**: POST
- **URL**: `http://localhost:8080/api/auth/resend-verification`
- **Body**:
```json
{
  "email": "test@example.com"
}
```

#### Request 10: Verify Email
- **Name**: Verify Email
- **Method**: POST
- **URL**: `http://localhost:8080/api/auth/verify-email`
- **Body**:
```json
{
  "email": "test@example.com",
  "code": "123456"
}
```

---

## 🖥️ Using cURL for Batch Testing

### Create `test.sh` script:
```bash
#!/bin/bash

echo "=== StoneSuite Auth API Testing ==="
echo ""

# Test 1: Register User
echo "1️⃣  Registering test user..."
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123","fullName":"Test User"}' \
  -w "\nStatus: %{http_code}\n\n"

# Test 2: Failed Login Attempt 1
echo "2️⃣  Failed login attempt 1..."
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}' \
  -w "\nStatus: %{http_code}\n\n"

# Test 3: Failed Login Attempt 2
echo "3️⃣  Failed login attempt 2..."
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}' \
  -w "\nStatus: %{http_code}\n\n"

# Test 4: Failed Login Attempt 3
echo "4️⃣  Failed login attempt 3..."
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}' \
  -w "\nStatus: %{http_code}\n\n"

# Test 5: Try login while locked
echo "5️⃣  Try login while account is locked..."
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123"}' \
  -w "\nStatus: %{http_code}\n\n"

# Test 6: Request password reset
echo "6️⃣  Requesting password reset..."
curl -X POST http://localhost:8080/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}' \
  -w "\nStatus: %{http_code}\n\n"

# Test 7: Resend verification
echo "7️⃣  Requesting email verification code..."
curl -X POST http://localhost:8080/api/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}' \
  -w "\nStatus: %{http_code}\n\n"

echo "✅ Testing complete! Check terminal logs for email tokens/codes."
```

**Run the script**:
```bash
chmod +x test.sh
./test.sh
```

---

## 📋 Manual Testing Checklist

### Password Attempt Limiting
- [ ] First failed login attempt - returns 401
- [ ] Second failed login attempt - returns 401
- [ ] Third failed login attempt - returns 401
- [ ] Fourth attempt while locked - returns 401 with lock message
- [ ] Wait 15 minutes or use password reset to unlock
- [ ] Login succeeds after unlock

### Password Reset
- [ ] Request reset with valid email - returns success
- [ ] Check email for token (or terminal logs)
- [ ] Reset with invalid token - returns error
- [ ] Reset with valid token - returns success
- [ ] Old password doesn't work anymore
- [ ] New password works for login
- [ ] Failed attempts counter is reset

### Email Verification
- [ ] Request verification with valid email - returns success
- [ ] Check email for 6-digit code (or terminal logs)
- [ ] Verify with wrong code - returns error
- [ ] Verify with correct code - returns success
- [ ] EmailVerified flag is set to true

### Edge Cases
- [ ] Invalid email format - returns error
- [ ] Empty email field - returns error
- [ ] Weak password (< 6 chars) - returns error
- [ ] Missing required fields - returns error
- [ ] Non-existent email - returns generic message (no info leak)

---

## 🔧 Debugging & Monitoring

### Check Terminal Logs
When backend is running, you'll see:
```
[2026-05-26T10:30:45Z] POST /api/auth/forgot-password
[2026-05-26T10:30:45Z] Password reset token generated for user: test@example.com
[2026-05-26T10:30:46Z] Email sent successfully to test@example.com
```

### View Reset Token in Logs
```
Password reset token generated for user: test@example.com
```

The token should be visible in the logs if email sending is not configured.

### Common Issues

**Issue**: "Account is locked" but shouldn't be
- **Solution**: 
  - Check `data/users.json` for `LockedUntil` timestamp
  - Use password reset to force unlock
  - Wait 15 minutes for auto-unlock

**Issue**: Email not sending
- **Solution**:
  - Check `.env` SMTP configuration
  - Look for email errors in terminal logs
  - System gracefully skips email if not configured

**Issue**: Reset token not working
- **Solution**:
  - Token expires in 1 hour
  - Get a new token from fresh password reset request
  - Copy token exactly (watch for whitespace)

---

## 📱 Testing with Insomnia

Insomnia is similar to Postman. Import the following as a collection:

1. **New Request** → Name: `Register User`
2. **New Request** → Name: `Failed Login` (repeat 3 times)
3. **New Request** → Name: `Login While Locked`
4. **New Request** → Name: `Forgot Password`
5. **New Request** → Name: `Reset Password`
6. **New Request** → Name: `Verify Email`

Set all to POST and use the same request bodies as shown above.

---

## ✅ Success Criteria

All tests pass when:
- ✅ Account locks after 3 failed attempts
- ✅ Locked account cannot login even with correct password
- ✅ Password reset generates valid token
- ✅ New password works after reset
- ✅ Email verification codes validate correctly
- ✅ All error messages are appropriate
- ✅ No information leakage in responses

---

## 🚀 Production Testing Checklist

Before deploying to production:
- [ ] Test with real SMTP credentials
- [ ] Verify email delivery time
- [ ] Test with multiple users simultaneously
- [ ] Test token expiration edge cases
- [ ] Monitor response times
- [ ] Check database for data integrity
- [ ] Test with various email providers
- [ ] Load test the endpoints
- [ ] Verify CORS configuration
- [ ] Test error handling thoroughly

---

**Last Updated**: May 26, 2026  
**API Version**: 1.0  
**Status**: Ready for Testing  
