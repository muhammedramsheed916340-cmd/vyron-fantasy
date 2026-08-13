#!/usr/bin/env python3
"""Test various TG API endpoints to find the real contest listing endpoint."""
import urllib.request
import urllib.error
import json
import sys

TG_API_BASE = "https://tgsoftware-api.online/api"
JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZDEyOWZjYzUzMjBjNDEwNWMxZmYyNyIsImlhdCI6MTc4NjQ0NDUyMywiZXhwIjoxNzg3NjU0MTIzfQ.xtTwCAFlEfcxqMsGUa7xMi05MfeXKPdsjTYmL1Idboo"

# First, get a match ID from the matches endpoint
print("=" * 60)
print("STEP 1: Fetch matches to get a real matchId")
print("=" * 60)

try:
    url = f"{TG_API_BASE}/fantasy/matches/cricket"
    req = urllib.request.Request(url, method='GET')
    req.add_header('Accept', 'application/json')
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode())
        if data.get('status') == 'success' and data.get('data'):
            print(f"  Got {len(data['data'])} encrypted matches")
            # The data is encrypted, we can't decrypt here
            # But we know match IDs are numeric from the TG API
        else:
            print(f"  Unexpected response: {json.dumps(data, indent=2)[:300]}")
except Exception as e:
    print(f"  Error: {e}")

# Test various contest-related endpoints on the TG API
print("\n" + "=" * 60)
print("STEP 2: Test TG API contest endpoints")
print("=" * 60)

# Possible contest endpoints to try
contest_endpoints = [
    # Direct contest listing
    ("GET", "/fantasy/contests", None),
    ("GET", "/fantasy/contests/cricket", None),
    ("POST", "/fantasy/list-contests", {"fantasyApp": "dream11", "matchId": 1}),
    ("POST", "/fantasy/list-contests", {"fantasyApp": "dream11", "matchId": 1, "authToken": JWT}),
    ("POST", "/fantasy/contests", {"fantasyApp": "dream11", "matchId": 1}),
    ("POST", "/fantasy/contests/list", {"fantasyApp": "dream11", "matchId": 1}),
    ("POST", "/fantasy/get-contests", {"fantasyApp": "dream11", "matchId": 1}),
    ("POST", "/fantasy/contest-list", {"fantasyApp": "dream11", "matchId": 1}),
    # With JWT in header
    ("POST", "/fantasy/list-contests", {"fantasyApp": "dream11", "matchId": 1, "token": JWT}),
    ("POST", "/fantasy/contests", {"fantasyApp": "dream11", "matchId": 1, "token": JWT}),
    # Try with different path structures
    ("GET", "/contests", None),
    ("GET", "/contests/list", None),
    ("POST", "/fantasy/joined-contests", {"fantasyApp": "dream11", "matchId": 1, "authToken": JWT}),
    # Try with the specific match listing that might include contests
    ("POST", "/fantasy/match-contests", {"fantasyApp": "dream11", "matchId": 1, "authToken": JWT}),
    ("POST", "/fantasy/match/contests", {"fantasyApp": "dream11", "matchId": 1, "authToken": JWT}),
]

for method, path, body in contest_endpoints:
    url = f"{TG_API_BASE}{path}"
    try:
        if body:
            body_bytes = json.dumps(body).encode('utf-8')
            req = urllib.request.Request(url, data=body_bytes, method=method)
            req.add_header('Content-Type', 'application/json')
        else:
            req = urllib.request.Request(url, method=method)
            req.add_header('Accept', 'application/json')
        
        # Add JWT as Authorization header
        req.add_header('Authorization', f'Bearer {JWT}')
        
        with urllib.request.urlopen(req, timeout=8) as resp:
            resp_data = resp.read().decode()
            status = resp.status
            try:
                parsed = json.loads(resp_data)
                preview = json.dumps(parsed, indent=2)[:200]
            except:
                preview = resp_data[:200]
            print(f"  ✅ {method} {path} → HTTP {status}")
            print(f"     Response: {preview}")
    except urllib.error.HTTPError as e:
        body_text = ''
        try:
            body_text = e.read().decode()[:150]
        except:
            pass
        print(f"  ❌ {method} {path} → HTTP {e.code}")
        if e.code != 404:
            print(f"     Response: {body_text}")
    except Exception as e:
        print(f"  ⚠️ {method} {path} → Error: {str(e)[:100]}")

print("\n" + "=" * 60)
print("STEP 3: Test list-of-teams endpoint (known working)")
print("=" * 60)

# Test the known working endpoint
try:
    url = f"{TG_API_BASE}/fantasy/list-of-teams"
    body = json.dumps({"fantasyApp": "dream11", "matchId": 1, "authToken": "test"}).encode()
    req = urllib.request.Request(url, data=body, method='POST')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Authorization', f'Bearer {JWT}')
    with urllib.request.urlopen(req, timeout=8) as resp:
        data = json.loads(resp.read().decode())
        print(f"  HTTP {resp.status}: {json.dumps(data, indent=2)[:200]}")
except urllib.error.HTTPError as e:
    body_text = ''
    try:
        body_text = e.read().decode()[:150]
    except:
        pass
    print(f"  HTTP {e.code}: {body_text}")
except Exception as e:
    print(f"  Error: {e}")

# Try the join-contest endpoint (also known to exist)
print("\n" + "=" * 60)
print("STEP 4: Test join-contest endpoint (known to exist per transfer/route.ts)")
print("=" * 60)

try:
    url = f"{TG_API_BASE}/fantasy/join-contest"
    body = json.dumps({"fantasyApp": "dream11", "matchId": 1, "authToken": "test", "teamId": 1, "contestId": "test"}).encode()
    req = urllib.request.Request(url, data=body, method='POST')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Authorization', f'Bearer {JWT}')
    with urllib.request.urlopen(req, timeout=8) as resp:
        data = json.loads(resp.read().decode())
        print(f"  HTTP {resp.status}: {json.dumps(data, indent=2)[:200]}")
except urllib.error.HTTPError as e:
    body_text = ''
    try:
        body_text = e.read().decode()[:150]
    except:
        pass
    print(f"  HTTP {e.code}: {body_text}")
except Exception as e:
    print(f"  Error: {e}")

print("\nDone!")
