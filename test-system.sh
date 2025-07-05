#!/bin/bash

echo "=== AUTOFORWARDX COMPREHENSIVE SYSTEM TEST ==="
echo "Testing all API endpoints and system functionality..."
echo

# Test 1: Core API Endpoints
echo "🔍 TESTING CORE API ENDPOINTS:"
echo "1. Sessions API:"
curl -s -w "Status: %{http_code}\n" http://localhost:5000/api/sessions
echo

echo "2. Pairs API:"
curl -s -w "Status: %{http_code}\n" http://localhost:5000/api/pairs
echo

echo "3. Stats API:"
curl -s -w "Status: %{http_code}\n" http://localhost:5000/api/stats
echo

echo "4. Activities API:"
curl -s -w "Status: %{http_code}\n" http://localhost:5000/api/activities
echo

echo "5. Copier Users API:"
curl -s -w "Status: %{http_code}\n" http://localhost:5000/api/copier/users
echo

# Test 2: Authentication Tests
echo "🔐 TESTING AUTHENTICATION:"
echo "1. Invalid PIN test:"
curl -s -X POST -H "Content-Type: application/json" -d '{"pin":"invalid"}' -w "Status: %{http_code}\n" http://localhost:5000/api/auth/login
echo

echo "2. Valid PIN test (default admin):"
curl -s -X POST -H "Content-Type: application/json" -d '{"pin":"1234"}' -w "Status: %{http_code}\n" http://localhost:5000/api/auth/login
echo

# Test 3: OTP Session Tests
echo "📱 TESTING OTP SYSTEM:"
echo "1. OTP Status check:"
curl -s -w "Status: %{http_code}\n" http://localhost:5000/api/sessions/otp-status/test123
echo

echo "2. Request OTP (test phone):"
curl -s -X POST -H "Content-Type: application/json" -d '{"phone":"test123"}' -w "Status: %{http_code}\n" http://localhost:5000/api/sessions/request-otp
echo

# Test 4: Environment Check
echo "⚙️  TESTING ENVIRONMENT:"
echo "1. Environment Config API:"
curl -s -w "Status: %{http_code}\n" http://localhost:5000/api/config/env
echo

# Test 5: Process Management
echo "🔄 TESTING PROCESS MANAGEMENT:"
echo "1. Start Copier:"
curl -s -X POST -w "Status: %{http_code}\n" http://localhost:5000/api/start/copier
echo

echo "2. Stop Copier:"
curl -s -X POST -w "Status: %{http_code}\n" http://localhost:5000/api/stop/copier
echo

# Test 6: Blocklist API
echo "🚫 TESTING BLOCKLIST:"
echo "1. Text blocklist:"
curl -s -w "Status: %{http_code}\n" http://localhost:5000/api/block/text
echo

echo "2. Image blocklist:"
curl -s -w "Status: %{http_code}\n" http://localhost:5000/api/block/images
echo

echo
echo "=== SYSTEM TEST COMPLETE ==="