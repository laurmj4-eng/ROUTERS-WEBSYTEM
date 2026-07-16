<?php

namespace App\Services\NetworkScanner;

use App\Models\ScanSession;
use App\Models\VulnerabilityFinding;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class CachedFirmwareChecker
{
    private int $cacheTtl;

    public function __construct(
        private FirmwareVersionChecker $checker,
    ) {
        $this->cacheTtl = config('scanning.cache.nvd_ttl', 86400);
    }

    public function check(ScanSession $session, string $firmwareVersion, string $vendor, string $product): array
    {
        $cacheKey = config('scanning.cache.prefix', 'nvd:') . "{$vendor}:{$product}";

        $cves = Cache::remember($cacheKey, $this->cacheTtl, function () use ($vendor, $product) {
            return $this->queryNvdDirectly($vendor, $product);
        });

        $findings = [];
        foreach ($cves as $cve) {
            if ($this->isAffected($firmwareVersion, $cve)) {
                $findings[] = $this->createFinding($session, $cve, $firmwareVersion, $vendor, $product);
            }
        }

        $vendorFindings = $this->checkVendorAdvisories($session, $vendor, $product, $firmwareVersion);

        return array_merge($findings, $vendorFindings);
    }

    public function invalidateCache(string $vendor, string $product): bool
    {
        $cacheKey = config('scanning.cache.prefix', 'nvd:') . "{$vendor}:{$product}";
        return Cache::forget($cacheKey);
    }

    private function queryNvdDirectly(string $vendor, string $product): array
    {
        $reflection = new \ReflectionClass($this->checker);
        $method = $reflection->getMethod('queryNvd');
        $method->setAccessible(true);

        return $method->invoke($this->checker, $vendor, $product);
    }

    private function isAffected(string $firmwareVersion, array $cve): bool
    {
        $reflection = new \ReflectionClass($this->checker);
        $method = $reflection->getMethod('isAffected');
        $method->setAccessible(true);

        return $method->invoke($this->checker, $firmwareVersion, $cve);
    }

    private function mapSeverity(string $cvss): string
    {
        $reflection = new \ReflectionClass($this->checker);
        $method = $reflection->getMethod('mapSeverity');
        $method->setAccessible(true);

        return $method->invoke($this->checker, $cvss);
    }

    private function createFinding(ScanSession $session, array $cve, string $version, string $vendor, string $product): VulnerabilityFinding
    {
        return VulnerabilityFinding::create([
            'scan_session_id' => $session->id,
            'cve_id' => $cve['id'],
            'severity' => $this->mapSeverity($cve['cvssSeverity'] ?? 'MEDIUM'),
            'description' => $cve['description'] ?? 'No description available',
            'affected_component' => "Firmware {$version} ({$vendor} {$product})",
            'remediation' => $cve['remediation'] ?? null,
            'cvss_score' => $cve['cvssScore'] ?? null,
            'source' => 'nvd',
        ]);
    }

    private function checkVendorAdvisories(ScanSession $session, string $vendor, string $product, string $version): array
    {
        $reflection = new \ReflectionClass($this->checker);
        $method = $reflection->getMethod('checkVendorAdvisories');
        $method->setAccessible(true);

        return $method->invoke($this->checker, $session, $vendor, $product, $version);
    }
}
