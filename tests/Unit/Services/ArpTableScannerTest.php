<?php

namespace Tests\Unit\Services;

use App\Services\NetworkScanner\ArpTableScanner;
use PHPUnit\Framework\TestCase;

class ArpTableScannerTest extends TestCase
{
    private ArpTableScanner $scanner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->scanner = new ArpTableScanner();
    }

    public function test_lookup_oui_returns_known_manufacturer(): void
    {
        $result = $this->scanner->lookupOui('00:e0:fc:12:34:56');
        $this->assertEquals('Huawei', $result);
    }

    public function test_lookup_oui_returns_null_for_unknown_mac(): void
    {
        $result = $this->scanner->lookupOui('ff:ff:ff:ff:ff:ff');
        $this->assertNull($result);
    }

    public function test_lookup_oui_is_case_insensitive(): void
    {
        $result1 = $this->scanner->lookupOui('00:E0:FC:12:34:56');
        $result2 = $this->scanner->lookupOui('00:e0:fc:12:34:56');

        $this->assertEquals($result1, $result2);
        $this->assertEquals('Huawei', $result1);
    }

    public function test_lookup_oui_for_raspberry_pi(): void
    {
        $result = $this->scanner->lookupOui('b8:27:eb:12:34:56');
        $this->assertEquals('Raspberry Pi', $result);
    }

    public function test_lookup_oui_for_netgear(): void
    {
        $result = $this->scanner->lookupOui('00:14:6c:12:34:56');
        $this->assertEquals('Netgear', $result);
    }

    public function test_lookup_oui_for_dlink(): void
    {
        $result = $this->scanner->lookupOui('00:1e:10:12:34:56');
        $this->assertEquals('D-Link', $result);
    }
}
