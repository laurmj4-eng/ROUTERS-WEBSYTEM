<?php

namespace Database\Seeders;

use App\Models\RouterCredential;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);

        // Seed initial router credential from env or default
        if (RouterCredential::count() === 0) {
            RouterCredential::create([
                'username' => env('ROUTER_USER', 'admin'),
                'password' => env('ROUTER_PASS', 'Admin1234'),
                'router_ip' => env('ROUTER_IP', '192.168.1.1'),
                'status' => 'active',
                'scheduled_at' => now()->addWeek(),
            ]);
        }
    }
}
