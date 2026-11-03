<!DOCTYPE html>
@php
    $systemName = config('app.name', 'Maaldhis');
    $systemFavicon = '/favicon.ico';
    try {
        $brandingSettings = \App\Models\SystemSetting::whereIn('setting_key', [
            'platform_name', 'system_name',
            'platform_favicon', 'system_favicon',
        ])->pluck('setting_value', 'setting_key');

        if (!empty($brandingSettings['system_name'])) {
            $systemName = $brandingSettings['system_name'];
        } elseif (!empty($brandingSettings['platform_name'])) {
            $systemName = $brandingSettings['platform_name'];
        }

        if (!empty($brandingSettings['system_favicon'])) {
            $systemFavicon = $brandingSettings['system_favicon'];
        } elseif (!empty($brandingSettings['platform_favicon'])) {
            $systemFavicon = $brandingSettings['platform_favicon'];
        }
    } catch (\Throwable $e) {
        // Fallback to defaults
    }
@endphp
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <title inertia>{{ $systemName }}</title>
        <link rel="icon" id="system-favicon" href="{{ $systemFavicon }}">
        <link rel="shortcut icon" id="system-shortcut-icon" href="{{ $systemFavicon }}">
        
        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=inter:400,500,600,700,800&display=swap" rel="stylesheet" />

        <!-- Scripts -->
        @viteReactRefresh
        @vite(['resources/js/app.jsx', 'resources/js/index.css'])
        @inertiaHead
    </head>
    <body class="font-sans antialiased bg-background text-foreground">
        @inertia
    </body>
</html>
