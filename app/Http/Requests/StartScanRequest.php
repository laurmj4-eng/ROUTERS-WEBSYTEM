<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StartScanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'scan_type' => 'sometimes|string|in:passive,firmware,topology,full',
            'sources' => 'sometimes|array',
            'sources.*' => 'string|in:arp,dhcp',
            'firmware_version' => 'nullable|string|max:64',
            'vendor' => 'nullable|string|max:32',
            'product' => 'nullable|string|max:32',
            'topology_baseline_id' => 'nullable|exists:topology_baselines,id',
        ];
    }
}
