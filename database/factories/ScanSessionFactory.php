<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ScanSessionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'scan_type' => $this->faker->randomElement(['passive', 'firmware', 'topology', 'full']),
            'status' => 'completed',
            'parameters' => ['sources' => ['arp', 'dhcp']],
            'started_at' => now()->subMinute(),
            'completed_at' => now(),
        ];
    }
}
