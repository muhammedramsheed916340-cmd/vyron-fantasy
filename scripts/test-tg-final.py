#!/usr/bin/env python3
"""Final comprehensive test of TG API endpoints."""
import urllib.request
import urllib.error
import json

TG_API_BASE = "https://tgsoftware-api.online/api"
JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZDEyOWZjYzUzMjBjNDEwNWMxZmYyNyIsImlhdCI6MTc4NjQ0NDUyMywiZXhwIjoxNzg3NjU0MTIzfQ.xtTwCAFlEfcxqMsGUa7xMi05MfeXKPdsjTYmL1Idboo"

print("=" * 60)
print("Test ALL possible TG API /fantasy/ routes")
print("=" * 60)

# Test every possible /fantasy/ path we can think of
paths = [
    # Known working
    ("GET", "/fantasy/matches/cricket"),
    ("GET", "/fantasy/match/113672"),
    
    # OTP
    ("POST", "/fantasy/send-otp"),
    ("POST", "/fantasy/verify-otp"),
    
    # Team management (known to work via TG proxy)
    ("POST", "/fantasy/list-of-teams"),
    ("POST", "/fantasy/add-team"),
    ("POST", "/fantasy/edit-team"),
    
    # Contest-related (testing all variations)
    ("POST", "/fantasy/list-contests"),
    ("POST", "/fantasy/get-contests"),
    ("POST", "/fantasy/contests"),
    ("POST", "/fantasy/contest-list"),
    ("GET", "/fantasy/contest/113672"),
    ("GET", "/fantasy/contests/113672"),
    ("GET", "/fantasy/contests/dream11/113672"),
    ("POST", "/fantasy/contest/list"),
    ("POST", "/fantasy/contest/get-list"),
    ("POST", "/fantasy/match-contests"),
    ("POST", "/fantasy/match/contests"),
    ("POST", "/fantasy/get-contest-list"),
    
    # Join contest
    ("POST", "/fantasy/join-contest"),
    ("POST", "/fantasy/join"),
    ("POST", "/fantasy/contest/join"),
    
    # Other fantasy endpoints
    ("POST", "/fantasy/contest-category"),
    ("POST", "/fantasy/contest-detail"),
    ("GET", "/fantasy/contest-detail/1"),
    ("POST", "/fantasy/my-contests"),
    ("POST", "/fantasy/joined-contests"),
    ("POST", "/fantasy/contest-info"),
    
    # With different base paths
    ("GET", "/contests"),
    ("GET", "/contest"),
    ("POST", "/contests/list"),
    ("POST", "/contest/list"),
]

working = []
not_found = []
errors = []

for method, path in paths:
    url = f"{TG_API_BASE}{path}"
    try:
        if method == 'POST':
            body = json.dumps({"matchId": 113672, "fantasyApp": "dream11", "authToken": JWT, "token": JWT}).encode()
            req = urllib.request.Request(url, data=body, method='POST')
            req.add_header('Content-Type', 'application/json')
            req.add_header('Authorization', f'Bearer {JWT}')
        else:
            req = urllib.request.Request(url, method='GET')
            req.add_header('Accept', 'application/json')
            if 'match' in path:
                req.add_header('Authorization', f'Bearer {JWT}')
        
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = resp.read().decode()
            working.append(f"{method} {path} → HTTP {resp.status}")
            try:
                parsed = json.loads(data)
                preview = json.dumps(parsed)[:100]
            except:
                preview = data[:100]
            print(f"  ✅ {method} {path} → HTTP {resp.status}")
            print(f"     {preview}")
    except urllib.error.HTTPError as e:
        body_text = ''
        try: body_text = e.read().decode()[:100]
        except: pass
        is_html_404 = '<!DOCTYPE' in body_text
        if e.code == 404 and is_html_404:
            not_found.append(f"{method} {path}")
        else:
            errors.append(f"{method} {path} → HTTP {e.code}")
            print(f"  ❌ {method} {path} → HTTP {e.code}: {body_text}")
    except Exception as e:
        errors.append(f"{method} {path} → {str(e)[:50]}")

print(f"\n{'=' * 60}")
print(f"Summary:")
print(f"  Working: {len(working)}")
for w in working:
    print(f"    ✅ {w}")
print(f"  Not Found (404): {len(not_found)}")
print(f"  Other Errors: {len(errors)}")
for e in errors:
    print(f"    ❌ {e}")
