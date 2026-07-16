<?php

namespace Database\Factories;

use App\Models\ScanSession;
use App\Models\TopologyBaseline;
use Illuminate\Database\Eloquent\Factories\Factory;

class TopologyDeviationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'scan_session_id' => ScanSession::factory(),
            'topology_baseline_id' => TopologyBaseline::factory(),
            'deviation_type' => $this->faker->randomElement(['unknown_device', 'missing_device', 'ip_conflict', 'mac_changed', 'wrong_subnet']),
            'details' => ['message' => $this->faker->sentence()],
            'severity' => $this->faker->randomElement(['warning', 'critical']),
        ];
    }
}
