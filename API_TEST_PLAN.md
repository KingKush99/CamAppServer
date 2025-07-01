# API Integration Test Plan

## User & Auth Endpoints

| Endpoint | Test Case Description | Expected Status | Result (Pass/Fail) | Notes |
|---|---|---|---|---|
| POST /register | Success: Register a new unique user | 201 Created | | |
| POST /register | Failure: Duplicate email | 409 Conflict | | |
| POST /register | Failure: Missing password in body | 400 Bad Request | | |
| POST /login | Success: Login with correct credentials | 200 OK | | |
| POST /login | Failure: Incorrect password | 400 Bad Request | | |
| POST /login | Failure: Non-existent email | 400 Bad Request | | |

## Profile Endpoints

| Endpoint | Test Case Description | Expected Status | Result (Pass/Fail) | Notes |
|---|---|---|---|---|
| GET /me | Success: Get profile with valid token | 200 OK | | |
| GET /me | Failure: No token provided | 401 Unauthorized | | |
| GET /me | Failure: Invalid/garbage token | 403 Forbidden | | |
| PUT /me | Success: Update display_name with valid token | 200 OK | | |
| GET /:id | Success: Get public profile of existing user | 200 OK | | |
| GET /:id | Failure: Get profile of non-existent user ID | 404 Not Found | | |

## Tipping Endpoint

| Endpoint | Test Case Description | Expected Status | Result (Pass/Fail) | Notes |
|---|---|---|---|---|
| POST /tip | Success: Full flow with funded wallets | 200 OK | | Check txHash on Polygonscan |
| POST /tip | Failure: Not enough NOVA tokens | 400/500 Error | | Check for "Insufficient funds" msg |
| POST /tip | Failure: Not enough MATIC for gas | 500 Error | | Check for gas-related error msg |
| POST /tip | Failure: Invalid recipientId | 404 Not Found | | |
| POST /tip | Failure: User tips themself | 400 Bad Request | | |
| POST /tip | Failure: Unauthenticated attempt | 401 Unauthorized | | |