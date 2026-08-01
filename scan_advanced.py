import socket
import struct
import time

target = "10.0.0.1"

def build_snmp_get(community, oid):
    """Build a minimal SNMPv1 GET request"""
    # SNMPv1 header
    version = 0  # v1
    community_bytes = community.encode()
    
    # OID: 1.3.6.1.2.1.1.1.0 (sysDescr.0)
    oid_parts = [int(x) for x in oid.split('.')]
    
    # Build the OID bytes
    oid_bytes = bytes([0x2b])  # 1.3
    for val in oid_parts[2:]:
        if val < 128:
            oid_bytes += bytes([val])
        else:
            oid_bytes += bytes([(val >> 7) | 0x80, val & 0x7F])
    
    # Build GetRequest PDU
    request_id = 12345
    error = 0
    error_index = 0
    
    # Variable binding
    varbind = bytes([0x30, 0x00])  # SEQUENCE
    oid_seq = bytes([0x06]) + bytes([len(oid_bytes)]) + oid_bytes  # OID
    null_val = bytes([0x05, 0x00])  # NULL
    varbind_item = bytes([0x30]) + bytes([len(oid_seq) + len(null_val)]) + oid_seq + null_val
    varbind = bytes([0x30]) + bytes([len(varbind_item)]) + varbind_item
    
    # PDU: GetRequest (0xa0)
    pdu_body = struct.pack('!i', request_id) + struct.pack('!i', error) + struct.pack('!i', error_index) + varbind
    pdu = bytes([0xa0]) + bytes([len(pdu_body)]) + pdu_body
    
    # Whole SNMP message
    snmp_body = bytes([version]) + bytes([len(community_bytes)]) + community_bytes + pdu
    snmp = bytes([0x30]) + bytes([len(snmp_body)]) + snmp_body
    
    return snmp

print("=== SNMP Deep Scan ===")
communities = ["public", "private", "admin", "lpb", "lpbpisowifi", "default", "all", "read", "write", "root", "user", "test"]
oids = ["1.3.6.1.2.1.1.1.0", "1.3.6.1.2.1.1.2.0", "1.3.6.1.2.1.1.3.0", "1.3.6.1.2.1.1.4.0", "1.3.6.1.2.1.25.1.1.0"]

for community in communities:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(3)
    for oid in oids:
        try:
            pkt = build_snmp_get(community, oid)
            sock.sendto(pkt, (target, 161))
            data, addr = sock.recvfrom(4096)
            print(f"  SNMP response community='{community}' oid={oid}: {len(data)} bytes")
            print(f"    First 50 bytes hex: {data[:50].hex()}")
            break
        except socket.timeout:
            continue
        except Exception as e:
            print(f"  SNMP error community='{community}': {e}")
            break
    sock.close()

print()
print("=== More TCP ports ===")
extra_ports = [123, 67, 68, 69, 53, 111, 389, 636, 3268, 3269, 5800, 5801, 5900, 5901, 6000, 6001, 6667, 6697, 7000, 7001, 7002, 7070, 7777, 7778, 8000, 8001, 8002, 8008, 8009, 8081, 8082, 8118, 8123, 8181, 8222, 8245, 8280, 8300, 8333, 8443, 8500, 8530, 8531, 8649, 8800, 8834, 8880, 8887, 8888, 8899, 8983, 9000, 9001, 9002, 9003, 9009, 9010, 9042, 9050, 9060, 9080, 9090, 9091, 9100, 9150, 9200, 9300, 9400, 9418, 9443, 9500, 9600, 9800, 9898, 9900, 9999, 10000, 10001, 10009, 10010, 10011, 10050, 10051, 10080, 10113, 10114, 10115, 10116, 10117, 10118, 1024, 1025, 1026, 1027, 1028, 1029, 1030, 1050, 1080, 1099, 1100, 1111, 1119, 11211, 1122, 1130, 1140, 1158, 1177, 1194, 1200, 1212, 1214, 1220, 1234, 1241, 1248, 1270, 1280, 1290, 1300, 1311, 1320, 1337, 1344, 1352, 1400, 1414, 1433, 1434, 1443, 1455, 1460, 1494, 1500, 1501, 1503, 1521, 1524, 1533, 1540, 1541, 1542, 1543, 1547, 1548, 1549, 1550, 1551, 1552, 1553, 1554, 1555, 1556, 1557, 1558, 1559, 1560, 1561, 1562, 1563, 1564, 1565, 1566, 1567, 1568, 1569, 1570, 1580, 1581, 1582, 1583, 1590, 1591, 1592, 1593, 1594, 1595, 1596, 1597, 1598, 1599, 1600, 1601, 1602, 1610, 1611, 1612, 1620, 1630, 1640, 1641, 1645, 1646, 1649, 1650, 1651, 1652, 1660, 1661, 1666, 1670, 1680, 1681, 1688, 1690, 1691, 1699, 1700, 1701, 1702, 1703, 1704, 1705, 1706, 1707, 1708, 1709, 1710, 1711, 1712, 1713, 1714, 1715, 1716, 1717, 1718, 1719, 1720, 1721, 1722, 1723, 1725, 1730, 1740, 1741, 1750, 1755, 1760, 1770, 1771, 1772, 1780, 1782, 1783, 1790, 1800, 1801, 1810, 1811, 1812, 1813, 1818, 1820, 1821, 1822, 1823, 1830, 1840, 1850, 1860, 1861, 1862, 1863, 1864, 1870, 1871, 1875, 1880, 1881, 1882, 1883, 1885, 1886, 1887, 1888, 1890, 1899, 1900, 1901, 1905, 1906, 1907, 1908, 1909, 1910, 1911, 1912, 1913, 1914, 1915, 1916, 1917, 1918, 1919, 1920, 1921, 1922, 1923, 1924, 1925, 1926, 1927, 1928, 1929, 1930, 1931, 1932, 1933, 1934, 1935, 1936, 1937, 1938, 1939, 1940, 1941, 1942, 1943, 1944, 1945, 1946, 1947, 1948, 1949, 1950, 1951, 1952, 1953, 1954, 1955, 1956, 1957, 1958, 1959, 1960, 1961, 1962, 1963, 1964, 1965, 1966, 1967, 1968, 1969, 1970, 1971, 1972, 1973, 1974, 1975, 1976, 1977, 1978, 1979, 1980, 1981, 1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000]
open_ports = []
for port in extra_ports:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.3)
        result = s.connect_ex((target, port))
        if result == 0:
            print(f"  TCP {port}: OPEN")
            open_ports.append(port)
            try:
                s.send(b"GET / HTTP/1.0\r\n\r\n")
                data = s.recv(200)
                print(f"    Response: {data[:100]}")
            except:
                pass
        s.close()
    except:
        pass

if open_ports:
    print(f"\nOpen ports: {open_ports}")
else:
    print("  No extra open ports found (only port 80)")

print()
print("=== Checking DHCP options from current lease ===")
# Try to see what DNS server the device provides
import subprocess
result = subprocess.run(["ipconfig", "/all"], capture_output=True, text=True)
print(result.stdout)
