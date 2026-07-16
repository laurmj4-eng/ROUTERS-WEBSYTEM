<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UploadTopologyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:64|unique:topology_baselines,name',
            'topology_file' => 'required|file|mimes:json,csv|max:1024',
        ];
    }
}
