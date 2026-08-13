#!/usr/bin/env python3
"""Test direct platform API calls and try to decrypt match data."""
import urllib.request
import urllib.error
import json
import base64
import hashlib

# ============ Decrypt Match Data ============
print("=" * 60)
print("Decrypt match data using CryptoJS-compatible method")
print("=" * 60)

TG_API_BASE = "https://tgsoftware-api.online/api"

# Get encrypted matches
try:
    url = f"{TG_API_BASE}/fantasy/matches/cricket"
    req = urllib.request.Request(url, method='GET')
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode())
        encrypted_matches = data.get('data', [])
except Exception as e:
    print(f"Error fetching matches: {e}")
    encrypted_matches = []

# CryptoJS AES decryption compatible method
def cryptojs_decrypt(encrypted_str, passphrase):
    """Decrypt data encrypted with CryptoJS AES using a string passphrase."""
    from Crypto.Cipher import AES
    from Crypto.Util.Padding import unpad
    
    raw = base64.b64decode(encrypted_str)
    
    # Check for "Salted__" prefix (CryptoJS default format)
    if raw[:8] == b'Salted__':
        salt = raw[8:16]
        ciphertext = raw[16:]
        
        # EVP_BytesToKey derivation (MD5-based, used by CryptoJS/OpenSSL)
        dtot = b''
        d = b''
        while len(dtot) < 48:  # 32 bytes key + 16 bytes IV
            d = hashlib.md5(d + passphrase + salt).digest()
            dtot += d
        
        key = dtot[:32]
        iv = dtot[32:48]
        
        cipher = AES.new(key, AES.MODE_CBC, iv)
        decrypted = unpad(cipher.decrypt(ciphertext), AES.block_size)
        return decrypted.decode('utf-8')
    else:
        # No salt - direct AES
        key = passphrase[:32]
        iv = passphrase[:16]
        cipher = AES.new(key, AES.MODE_CBC, iv)
        decrypted = unpad(cipher.decrypt(raw), AES.block_size)
        return decrypted.decode('utf-8')

ENCRYPTION_KEY = b'coder_bobby_believer01_tg_software'

match_ids = []
for i, enc_match in enumerate(encrypted_matches[:5]):
    try:
        decrypted = cryptojs_decrypt(enc_match, ENCRYPTION_KEY)
        match_data = json.loads(decrypted)
        
        match_id = match_data.get('id', 'N/A')
        left_team = match_data.get('left_team_name', '?')
        right_team = match_data.get('right_team_name', '?')
        fantasy_list = match_data.get('fantasy_list', [])
        sport_index = match_data.get('sport_index', 0)
        lineup_out = match_data.get('lineup_out', 0)
        
        match_ids.append({
            'id': match_id,
            'left': left_team,
            'right': right_team,
            'fantasy_list': fantasy_list,
            'sport_index': sport_index,
            'lineup_out': lineup_out,
        })
        
        print(f"  Match {i+1}:")
        print(f"    ID: {match_id} (type: {type(match_id).__name__})")
        print(f"    Teams: {left_team} vs {right_team}")
        print(f"    Sport Index: {sport_index}, Lineup: {lineup_out}")
        print(f"    Fantasy List: {fantasy_list}")
    except Exception as e:
        print(f"  Match {i+1} decrypt error: {e}")

# ============ Test Dream11 API ============
print("\n" + "=" * 60)
print("Test Dream11 API directly")
print("=" * 60)

if match_ids:
    test_match_id = match_ids[0]['id']
    print(f"  Using matchId: {test_match_id} ({match_ids[0]['left']} vs {match_ids[0]['right']})")
    
    # Dream11 contest category endpoint
    urls_to_test = [
        f"https://api.dream11.com/1/contest/category/m/{test_match_id}",
        f"https://api.dream11.com/1/contest/list?matchId={test_match_id}",
        f"https://api.dream11.com/1/match/info/{test_match_id}",
    ]
    
    for url in urls_to_test:
        try:
            req = urllib.request.Request(url, method='GET')
            req.add_header('User-Agent', 'Dream11/8.29.0 (Android 12; SM-G991B)')
            req.add_header('Accept', 'application/json')
            req.add_header('x-platform', 'android')
            req.add_header('x-app-ver', '8.29.0')
            req.add_header('x-lang', 'en')
            
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = resp.read().decode()
                print(f"  ✅ GET {url.split('dream11.com')[1]} → HTTP {resp.status}")
                try:
                    parsed = json.loads(data)
                    print(f"     Keys: {list(parsed.keys()) if isinstance(parsed, dict) else type(parsed).__name__}")
                    print(f"     Preview: {json.dumps(parsed, indent=2)[:200]}")
                except:
                    print(f"     Non-JSON: {data[:200]}")
        except urllib.error.HTTPError as e:
            body = ''
            try: body = e.read().decode()[:200]
            except: pass
            print(f"  ❌ GET {url.split('dream11.com')[1]} → HTTP {e.code}")
            print(f"     {body}")
        except Exception as e:
            print(f"  ⚠️ GET {url.split('dream11.com')[1]} → Error: {str(e)[:100]}")

# ============ Test My11Circle API ============
print("\n" + "=" * 60)
print("Test My11Circle API directly")
print("=" * 60)

if match_ids:
    test_match_id = match_ids[0]['id']
    
    urls_to_test = [
        ("POST", "https://www.my11circle.com/api/contest/get-contest-list", {"matchId": int(test_match_id) if isinstance(test_match_id, (int, float)) else test_match_id}),
        ("GET", f"https://www.my11circle.com/api/contest/get-contest-list?matchId={test_match_id}", None),
    ]
    
    for method, url, body in urls_to_test:
        try:
            if body:
                body_bytes = json.dumps(body).encode('utf-8')
                req = urllib.request.Request(url, data=body_bytes, method=method)
                req.add_header('Content-Type', 'application/json')
            else:
                req = urllib.request.Request(url, method=method)
            req.add_header('User-Agent', 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36')
            req.add_header('Accept', 'application/json')
            
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = resp.read().decode()
                print(f"  ✅ {method} {url.split('my11circle.com')[1]} → HTTP {resp.status}")
                try:
                    parsed = json.loads(data)
                    print(f"     Keys: {list(parsed.keys()) if isinstance(parsed, dict) else type(parsed).__name__}")
                    print(f"     Preview: {json.dumps(parsed, indent=2)[:200]}")
                except:
                    print(f"     Non-JSON: {data[:200]}")
        except urllib.error.HTTPError as e:
            body_text = ''
            try: body_text = e.read().decode()[:200]
            except: pass
            print(f"  ❌ {method} {url.split('my11circle.com')[1]} → HTTP {e.code}")
            print(f"     {body_text}")
        except Exception as e:
            print(f"  ⚠️ {method} {url.split('my11circle.com')[1]} → Error: {str(e)[:100]}")

print("\nDone!")
