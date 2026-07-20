#!/usr/bin/env python3
"""Probe SSH/Telnet/SNMP on the router."""
import socket

ROUTER = "192.168.1.1"

# SSH
print("=== SSH (port 22) ===")
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.settimeout(3)
try:
    result = sock.connect_ex((ROUTER, 22))
    if result == 0:
        print("  OPEN")
        banner = sock.recv(1024).decode("utf-8", errors="replace")
        print(f"  Banner: {banner.strip()}")
    else:
        print("  CLOSED")
except Exception as e:
    print(f"  Error: {e}")
finally:
    sock.close()

# Telnet
print("\n=== Telnet (port 23) ===")
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.settimeout(3)
try:
    result = sock.connect_ex((ROUTER, 23))
    if result == 0:
        print("  OPEN")
        data = sock.recv(1024)
        print(f"  Banner: {data[:100]}")
    else:
        print("  CLOSED")
except Exception as e:
    print(f"  Error: {e}")
finally:
    sock.close()

# HTTP port 80
print("\n=== HTTP (port 80) ===")
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.settimeout(3)
try:
    result = sock.connect_ex((ROUTER, 80))
    print(f"  {'OPEN' if result == 0 else 'CLOSED'}")
except Exception as e:
    print(f"  Error: {e}")
finally:
    sock.close()

# HTTPS port 443
print("\n=== HTTPS (port 443) ===")
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.settimeout(3)
try:
    result = sock.connect_ex((ROUTER, 443))
    print(f"  {'OPEN' if result == 0 else 'CLOSED'}")
except Exception as e:
    print(f"  Error: {e}")
finally:
    sock.close()

# SNMP
print("\n=== SNMP (port 161) ===")
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.settimeout(3)
try:
    snmp_payload = bytes([
        0x30, 0x26,
        0x02, 0x01, 0x00,
        0x04, 0x06, 0x70, 0x75, 0x62, 0x6c, 0x69, 0x63,
        0xa0, 0x19,
        0x02, 0x01, 0x00,
        0x02, 0x01, 0x00,
        0x02, 0x01, 0x00,
        0x30, 0x0b,
        0x30, 0x09,
        0x06, 0x05, 0x2b, 0x06, 0x01, 0x02, 0x01,
        0x05, 0x00
    ])
    sock.sendto(snmp_payload, (ROUTER, 161))
    data, addr = sock.recvfrom(1024)
    print(f"  OPEN - {len(data)} bytes response")
    # Try to decode sysDescr
    for i, b in enumerate(data):
        if b == 0x04 and i + 2 < len(data):
            length = data[i + 1]
            if 10 < length < 200:
                val = data[i + 2 : i + 2 + length]
                try:
                    decoded = val.decode("utf-8", errors="replace")
                    if any(c.isalpha() for c in decoded):
                        print(f"  Decoded: {decoded}")
                except:
                    pass
except socket.timeout:
    print("  No response (filtered)")
except Exception as e:
    print(f"  Error: {e}")
finally:
    sock.close()

# Try multiple SNMP communities
print("\n=== SNMP Community Strings ===")
communities = ["public", "private", "admin", "huawei", "pldt", "test", "snmp"]
for community in communities:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(2)
    try:
        comm_bytes = community.encode()
        payload = bytes([
            0x30,
            2 + 3 + 2 + len(comm_bytes) + 21,
            0x02, 0x01, 0x00,
            0x04, len(comm_bytes),
        ]) + comm_bytes + bytes([
            0xa0, 0x15,
            0x02, 0x01, 0x00,
            0x02, 0x01, 0x00,
            0x02, 0x01, 0x00,
            0x30, 0x09,
            0x30, 0x07,
            0x06, 0x05, 0x2b, 0x06, 0x01, 0x02, 0x01,
            0x05, 0x00
        ])
        sock.sendto(payload, (ROUTER, 161))
        data, _ = sock.recvfrom(1024)
        if len(data) > 10:
            print(f"  Community '{community}': RESPONDED ({len(data)} bytes)")
        else:
            print(f"  Community '{community}': no useful response")
    except socket.timeout:
        print(f"  Community '{community}': timeout")
    except Exception as e:
        print(f"  Community '{community}': {e}")
    finally:
        sock.close()
