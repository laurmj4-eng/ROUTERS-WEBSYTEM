<?php

namespace Database\Factories;

use App\Models\ScanSession;
use Illuminate\Database\Eloquent\Factories\Factory;

class DiscoveredDeviceFactory extends Factory
{
    public function definition(): array
    {
        return [
            'scan_session_id' => ScanSession::factory(),
            'ip_address' => $this->faker->ipv4(),
            'mac_address' => strtoupper($this->faker->macAddress()),
            'hostname' => $this->faker->optional(0.7)->word(),
            'manufacturer' => $this->faker->optional(0.5)->randomElement(['Huawei', 'Raspberry Pi', 'Netgear', 'D-Link']),
            'device_type' => $this->faker->optional(0.6)->randomElement(['router', 'laptop', 'phone', 'iot', 'unknown']),
            'connection_type' => $this->faker->randomElement(['arp', 'dhcp']),
        ];
    }
}
