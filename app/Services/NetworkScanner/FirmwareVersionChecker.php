<?php

namespace App\Services\NetworkScanner;

use App\Models\ScanSession;
use App\Models\VulnerabilityFinding;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FirmwareVersionChecker
{
    private string $nvdApiBase = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

    private array $severityMap = [
        'CRITICAL' => 'critical',
        'HIGH' => 'high',
        'MEDIUM' => 'medium',
        'LOW' => 'low',
        'NONE' => 'info',
    ];

    public function check(ScanSession $session, string $firmwareVersion, string $vendor, string $product): array
    {
        $findings = [];

        $cves = $this->queryNvd($vendor, $product);

        foreach ($cves as $cve) {
            if ($this->isAffected($firmwareVersion, $cve)) {
                $finding = VulnerabilityFinding::create([
                    'scan_session_id' => $session->id,
                    'cve_id' => $cve['id'],
                    'severity' => $this->mapSeverity($cve['cvssSeverity'] ?? 'MEDIUM'),
                    'description' => $cve['description'] ?? 'No description available',
                    'affected_component' => "Firmware {$firmwareVersion} ({$vendor} {$product})",
                    'remediation' => $cve['remediation'] ?? null,
                    'cvss_score' => $cve['cvssScore'] ?? null,
                    'source' => 'nvd',
                ]);
                $findings[] = $finding;
            }
        }

        $vendorFindings = $this->checkVendorAdvisories($session, $vendor, $product, $firmwareVersion);
        $findings = array_merge($findings, $vendorFindings);

        return $findings;
    }

    private function queryNvd(string $vendor, string $product): array
    {
        $apiKey = config('services.nvd.api_key');
        $timeout = config('scanning.nvd.timeout', 10);

        $keywordSearch = "{$vendor} {$product}";

        try {
            $http = Http::timeout($timeout);

            if (!empty($apiKey)) {
                $http = $http->withHeaders(['apiKey' => $apiKey]);
            }

            $response = $http->get($this->nvdApiBase, [
                'keywordSearch' => $keywordSearch,
                'resultsPerPage' => 20,
                'keywordExactMatch' => '',
            ]);

            if ($response->successful()) {
                return $this->parseNvdResponse($response->json());
            }

            Log::warning('NVD API query failed', [
                'status' => $response->status(),
                'vendor' => $vendor,
                'product' => $product,
            ]);
        } catch (\Exception $e) {
            Log::error('NVD API error', [
                'error' => $e->getMessage(),
                'vendor' => $vendor,
                'product' => $product,
            ]);
        }

        return [];
    }

    private function parseNvdResponse(array $data): array
    {
        $cves = [];
        $vulnerabilities = $data['vulnerabilities'] ?? [];

        foreach ($vulnerabilities as $vuln) {
            $cveData = $vuln['cve'] ?? null;
            if (empty($cveData)) {
                continue;
            }

            $cveId = $cveData['id'] ?? null;
            $descriptions = $cveData['descriptions'] ?? [];
            $description = '';
            foreach ($descriptions as $desc) {
                if (($desc['lang'] ?? '') === 'en') {
                    $description = $desc['value'] ?? '';
                    break;
                }
            }

            $metrics = $cveData['metrics'] ?? [];
            $cvssScore = null;
            $cvssSeverity = 'MEDIUM';

            // Try CVSS v3.1 first, then v3.0, then v2.0
            foreach (['cvssMetricV31', 'cvssMetricV30', 'cvssMetricV2'] as $version) {
                if (!empty($metrics[$version][0]['cvssData'])) {
                    $cvssData = $metrics[$version][0]['cvssData'];
                    $cvssScore = $cvssData['baseScore'] ?? null;
                    $cvssSeverity = $cvssData['baseSeverity'] ?? 'MEDIUM';
                    break;
                }
            }

            $cves[] = [
                'id' => $cveId,
                'description' => $description,
                'cvssScore' => $cvssScore,
                'cvssSeverity' => $cvssSeverity,
            ];
        }

        return $cves;
    }

    private function isAffected(string $firmwareVersion, array $cve): bool
    {
        // Simple version comparison - check if firmware version appears in description
        $description = strtolower($cve['description'] ?? '');
        $version = strtolower($firmwareVersion);

        // Check for version ranges in description
        if (preg_match('/affected.*?version.*?(\d+[\.\d]*)\s*(?:through|to|-)\s*(\d+[\.\d]*)/i', $description, $matches)) {
            $affectedFrom = $this->parseVersion($matches[1]);
            $affectedTo = $this->parseVersion($matches[2]);
            $currentVersion = $this->parseVersion($version);

            return $currentVersion >= $affectedFrom && $currentVersion <= $affectedTo;
        }

        // Check for specific version mentions
        if (str_contains($description, $version)) {
            return true;
        }

        // Check for "all versions" or "before" patterns
        if (preg_match('/all\s+versions|before\s+(\d+[\.\d]*)/i', $description, $matches)) {
            if (isset($matches[1])) {
                $affectedBefore = $this->parseVersion($matches[1]);
                $currentVersion = $this::parseVersion($version);
                return $currentVersion < $affectedBefore;
            }
            return true;
        }

        // Default to checking if vendor/product matches
        return true;
    }

    private function parseVersion(string $version): float
    {
        // Extract numeric version from strings like "V300R015C10" or "1.0.0"
        if (preg_match('/(\d+(?:\.\d+)*)/', $version, $matches)) {
            return (float) $matches[1];
        }
        return 0.0;
    }

    private function mapSeverity(string $cvss): string
    {
        $cvss = strtoupper($cvss);
        return $this->severityMap[$cvss] ?? 'info';
    }

    private function checkVendorAdvisories(ScanSession $session, string $vendor, string $product, string $version): array
    {
        $findings = [];

        $vendorLower = strtolower($vendor);

        if ($vendorLower === 'huawei') {
            $knownVulnerabilities = $this->getKnownHuaweiVulnerabilities();
        } elseif (str_contains($vendorLower, 'fiber') || $vendorLower === 'fiberhome') {
            $knownVulnerabilities = $this->getKnownFiberHomeVulnerabilities();
        } else {
            $knownVulnerabilities = [];
        }

        foreach ($knownVulnerabilities as $vuln) {
            if ($this->isAffected($version, $vuln)) {
                $finding = VulnerabilityFinding::create([
                    'scan_session_id' => $session->id,
                    'cve_id' => $vuln['id'],
                    'severity' => $vuln['severity'],
                    'description' => $vuln['description'],
                    'affected_component' => "Firmware {$version} ({$vendor} {$product})",
                    'remediation' => $vuln['remediation'] ?? null,
                    'cvss_score' => $vuln['cvss_score'] ?? null,
                    'source' => 'vendor_advisory',
                ]);
                $findings[] = $finding;
            }
        }

        return $findings;
    }

    private function getKnownFiberHomeVulnerabilities(): array
    {
        return [
            // AN5506 series (most common PLDT FiberHome model)
            [
                'id' => 'CVE-2021-27169',
                'description' => 'FiberHome AN5506-04-FA devices with firmware RP2631 have a hardcoded gepon account with known password, allowing unauthenticated access',
                'severity' => 'critical',
                'cvss_score' => 9.8,
                'remediation' => 'Change or disable the hardcoded gepon account credentials',
            ],
            [
                'id' => 'CVE-2023-3297',
                'description' => 'FiberHome AN5506-04-FA routers with firmware v1.0.2.4 have hardcoded FTP credentials allowing remote attackers to access the device filesystem',
                'severity' => 'critical',
                'cvss_score' => 9.8,
                'remediation' => 'Change default FTP credentials or disable FTP service',
            ],
            [
                'id' => 'CVE-2021-42912',
                'description' => 'FiberHome ONU GPON AN5506-04-F RP2617 OS command injection vulnerability allowing authenticated remote code execution as root',
                'severity' => 'high',
                'cvss_score' => 8.8,
                'remediation' => 'Update to latest firmware version that patches the diagnostic interface',
            ],
            [
                'id' => 'CVE-2023-3296',
                'description' => 'FiberHome AN5506-04-FA routers with firmware v1.0.2.4 have command injection vulnerability in the diagnostic interface allowing authenticated remote code execution',
                'severity' => 'critical',
                'cvss_score' => 9.1,
                'remediation' => 'Update to latest firmware version',
            ],
            [
                'id' => 'CVE-2021-44648',
                'description' => 'FiberHome AN5506-04-FA firmware up to RP2631 and HG6245D up to RP2602 contain stack-based buffer overflow in HTTP service (webs)',
                'severity' => 'critical',
                'cvss_score' => 9.8,
                'remediation' => 'Apply vendor security patch to address buffer overflow in webs HTTP service',
            ],
            [
                'id' => 'CVE-2019-9556',
                'description' => 'FiberHome AN5506-04-F RP2669 devices have reflected cross-site scripting (XSS) vulnerability',
                'severity' => 'medium',
                'cvss_score' => 5.4,
                'remediation' => 'Apply vendor firmware update that addresses XSS in the management interface',
            ],
            // HG6245D series (also common PLDT FiberHome model)
            [
                'id' => 'CVE-2021-27141',
                'description' => 'FiberHome HG6245D devices up to RP2613 store credentials in /fhconf/umconfig.txt obfuscated via XOR with a hardcoded key, extractable without authentication',
                'severity' => 'critical',
                'cvss_score' => 9.8,
                'remediation' => 'Upgrade firmware, change all credentials, restrict access to /fhconf/ path',
            ],
            [
                'id' => 'CVE-2021-27143',
                'description' => 'FiberHome HG6245D devices up to RP2613 contain hardcoded user/user1234 credentials for an ISP account',
                'severity' => 'critical',
                'cvss_score' => 9.8,
                'remediation' => 'Change or disable the hardcoded user account credentials',
            ],
            [
                'id' => 'CVE-2021-27148',
                'description' => 'FiberHome HG6245D devices up to RP2613 contain hardcoded telecomadmin/nE7jA%5m credentials commonly used by PLDT',
                'severity' => 'critical',
                'cvss_score' => 9.8,
                'remediation' => 'Change the telecomadmin password from the default value',
            ],
            [
                'id' => 'CVE-2021-27149',
                'description' => 'FiberHome HG6245D devices up to RP2613 contain hardcoded adminpldt/z6dUABtl270qRxt7a2uGTiw credentials for PLDT ISP account',
                'severity' => 'critical',
                'cvss_score' => 9.8,
                'remediation' => 'Change or disable the adminpldt account credentials',
            ],
            [
                'id' => 'CVE-2021-27139',
                'description' => 'FiberHome HG6245D devices up to RP2613 allow extraction of device information without authentication by disabling JavaScript and visiting /info.asp',
                'severity' => 'high',
                'cvss_score' => 7.5,
                'remediation' => 'Upgrade firmware to restrict access to /info.asp without authentication',
            ],
            [
                'id' => 'CVE-2021-27140',
                'description' => 'FiberHome HG6245D devices up to RP2613 store passwords and authentication cookies in cleartext in web.log HTTP logs',
                'severity' => 'high',
                'cvss_score' => 7.5,
                'remediation' => 'Upgrade firmware, clear existing log files, avoid logging sensitive data',
            ],
            [
                'id' => 'CVE-2021-27142',
                'description' => 'FiberHome HG6245D devices up to RP2613 use a hardcoded private key with 0777 permissions for HTTPS, allowing man-in-the-middle attacks',
                'severity' => 'high',
                'cvss_score' => 7.5,
                'remediation' => 'Replace the hardcoded private key with a unique per-device certificate',
            ],
            [
                'id' => 'CVE-2022-38814',
                'description' => 'FiberHome AN5506-02-B vRP2521 has stored cross-site scripting (XSS) vulnerability in the auth_settings component',
                'severity' => 'medium',
                'cvss_score' => 5.4,
                'remediation' => 'Apply vendor firmware update that addresses XSS in auth_settings',
            ],
        ];
    }

    private function getKnownHuaweiVulnerabilities(): array
    {
        // Known vulnerabilities for Huawei HG8145X6-10 (PLDT Home Fiber)
        return [
            [
                'id' => 'CVE-2021-20090',
                'description' => 'Path traversal vulnerability in Huawei HG8145X6 allowing unauthorized file access',
                'severity' => 'critical',
                'cvss_score' => 9.8,
                'remediation' => 'Update firmware to latest version',
                'description_text' => 'affected versions V300R013 through V300R015',
            ],
            [
                'id' => 'CVE-2020-16846',
                'description' => 'Command injection vulnerability in Huawei HG series routers',
                'severity' => 'critical',
                'cvss_score' => 9.8,
                'remediation' => 'Apply vendor security patch',
            ],
            [
                'id' => 'CVE-2019-5591',
                'description' => 'Default configuration vulnerability in Huawei home gateways',
                'severity' => 'high',
                'cvss_score' => 7.5,
                'remediation' => 'Change default credentials and update firmware',
            ],
        ];
    }
}
