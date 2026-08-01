import scapy.all as scapy

# Check interfaces
print('Interfaces (get_if_list):')
try:
    ifaces = scapy.get_if_list()
    for i in ifaces:
        print(f'  {i}')
except Exception as e:
    print(f'  Error: {e}')

print('\nConfigure use_pcap...')
scapy.conf.use_pcap = True
print(f'use_pcap = {scapy.conf.use_pcap}')

# Try a simple send with explicit interface
print('\nTry sending ARP...')
try:
    from scapy.all import Ether, ARP
    # ARP who-has
    arp = Ether(dst="ff:ff:ff:ff:ff:ff")/ARP(pdst="10.0.0.1")
    ans = scapy.sendp(arp, iface="Wi-Fi", verbose=0, timeout=2)
    print('ARP packet sent!')
except Exception as e:
    print(f'ARP send error: {type(e).__name__}: {e}')

print('\nTry sniffing...')
try:
    pkts = scapy.sniff(timeout=3, count=1)
    print(f'Sniffed {len(pkts)} packets')
    if pkts:
        print(f'First packet: {pkts[0].summary()}')
except Exception as e:
    print(f'Sniff error: {type(e).__name__}: {e}')
