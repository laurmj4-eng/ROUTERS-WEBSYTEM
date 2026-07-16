<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class TopologyBaselineFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => $this->faker->unique()->slug(2),
            'filename' => $this->faker->word() . '.json',
            'file_hash' => hash('sha256', $this->faker->text()),
            'expected_devices' => [
                [
                    'name' => 'Router',
                    'mac_address' => strtoupper($this->faker->macAddress()),
                    'ip_address' => '192.168.1.1',
                    'device_type' => 'router',
                ],
            ],
            'user_id' => User::factory(),
        ];
    }
}
