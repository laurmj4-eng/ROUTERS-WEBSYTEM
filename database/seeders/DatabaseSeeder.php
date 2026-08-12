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
     * Friend accounts: set SEED_FRIEND=friend1 (or leave empty to seed all)
     * and optionally override passwords via SEED_FRIEND1_PASS=... etc.
     */
    private array $friends = [
        'friend1' => ['name' => 'Friend 1', 'email' => 'friend1@adu.local'],
        'friend2' => ['name' => 'Friend 2', 'email' => 'friend2@adu.local'],
        'friend3' => ['name' => 'Friend 3', 'email' => 'friend3@adu.local'],
        'friend4' => ['name' => 'Friend 4', 'email' => 'friend4@adu.local'],
        'friend5' => ['name' => 'Friend 5', 'email' => 'friend5@adu.local'],
    ];

    public function run(): void
    {
        if (! User::where('email', 'test@example.com')->exists()) {
            User::create([
                'name' => 'Test User',
                'email' => 'test@example.com',
                'password' => env('SEED_TEST_PASS', 'test2026!'),
            ]);
        }

        $seedFriend = strtolower((string) env('SEED_FRIEND', ''));
        foreach ($this->friends as $key => $friend) {
            if ($seedFriend !== '' && $seedFriend !== $key) {
                continue;
            }
            $password = (string) env('SEED_'.strtoupper($key).'_PASS', 'adu'.$key.'2026!');
            if (User::where('email', $friend['email'])->exists()) {
                continue;
            }
            User::create([
                'name' => $friend['name'],
                'email' => $friend['email'],
                'password' => $password,
            ]);
        }

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
