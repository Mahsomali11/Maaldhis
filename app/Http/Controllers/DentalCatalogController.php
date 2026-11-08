<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Models\DentalService;
use App\Models\DentalItem;
use App\Models\Store;

class DentalCatalogController extends Controller
{
    // ==========================================
    // DENTAL CLINICAL SERVICES
    // ==========================================

    /**
     * List all services for a given clinic/store.
     */
    public function getServices(Request $request)
    {
        $storeId = $request->query('store_id') ?? $request->input('store_id');
        if (!$storeId) {
            return response()->json(['error' => 'store_id is required'], 400);
        }

        $query = DentalService::where('store_id', $storeId)
            ->where('is_active', true)
            ->orderBy('name', 'asc');

        if ($request->has('category') && $request->category !== 'all') {
            $query->where('category', $request->category);
        }

        return response()->json($query->get());
    }

    /**
     * Create a new clinical service procedure.
     */
    public function storeService(Request $request)
    {
        $validated = $request->validate([
            'store_id' => 'required|exists:stores,id',
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:100',
            'price' => 'required|numeric|min:0',
            'category' => 'nullable|string|max:100',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        $validated['id'] = (string) Str::uuid();
        $validated['code'] = $validated['code'] ?? ('SRV-' . strtoupper(Str::random(4)));
        $validated['is_active'] = $validated['is_active'] ?? true;

        $service = DentalService::create($validated);

        return response()->json($service, 201);
    }

    /**
     * Update an existing clinical service.
     */
    public function updateService(Request $request, string $id)
    {
        $service = DentalService::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'code' => 'nullable|string|max:100',
            'price' => 'sometimes|required|numeric|min:0',
            'category' => 'nullable|string|max:100',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        $service->update($validated);

        return response()->json($service);
    }

    /**
     * Soft delete / deactivate a clinical service.
     */
    public function destroyService(Request $request, string $id)
    {
        $service = DentalService::findOrFail($id);
        $service->update(['is_active' => false]);

        return response()->json([
            'message' => 'Dental service removed successfully',
            'id' => $id,
        ]);
    }

    // ==========================================
    // DENTAL PHYSICAL ITEMS / CONSUMABLES
    // ==========================================

    /**
     * List all dental items for a given clinic/store.
     */
    public function getItems(Request $request)
    {
        $storeId = $request->query('store_id') ?? $request->input('store_id');
        if (!$storeId) {
            return response()->json(['error' => 'store_id is required'], 400);
        }

        $query = DentalItem::where('store_id', $storeId)
            ->where('is_active', true)
            ->orderBy('name', 'asc');

        if ($request->has('category') && $request->category !== 'all') {
            $query->where('category', $request->category);
        }

        return response()->json($query->get());
    }

    /**
     * Create a new dental consumable / physical item.
     */
    public function storeItem(Request $request)
    {
        $validated = $request->validate([
            'store_id' => 'required|exists:stores,id',
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:100',
            'cost_price' => 'nullable|numeric|min:0',
            'retail_price' => 'required|numeric|min:0',
            'stock_quantity' => 'nullable|numeric|min:0',
            'reorder_level' => 'nullable|numeric|min:0',
            'category' => 'nullable|string|max:100',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        $validated['id'] = (string) Str::uuid();
        $validated['code'] = $validated['code'] ?? ('DEN-' . strtoupper(Str::random(4)));
        $validated['cost_price'] = $validated['cost_price'] ?? 0;
        $validated['stock_quantity'] = $validated['stock_quantity'] ?? 0;
        $validated['reorder_level'] = $validated['reorder_level'] ?? 5;
        $validated['is_active'] = $validated['is_active'] ?? true;

        $item = DentalItem::create($validated);

        return response()->json($item, 201);
    }

    /**
     * Update an existing dental consumable item.
     */
    public function updateItem(Request $request, string $id)
    {
        $item = DentalItem::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'code' => 'nullable|string|max:100',
            'cost_price' => 'nullable|numeric|min:0',
            'retail_price' => 'sometimes|required|numeric|min:0',
            'stock_quantity' => 'nullable|numeric|min:0',
            'reorder_level' => 'nullable|numeric|min:0',
            'category' => 'nullable|string|max:100',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        $item->update($validated);

        return response()->json($item);
    }

    /**
     * Soft delete / deactivate a dental item.
     */
    public function destroyItem(Request $request, string $id)
    {
        $item = DentalItem::findOrFail($id);
        $item->update(['is_active' => false]);

        return response()->json([
            'message' => 'Dental item removed successfully',
            'id' => $id,
        ]);
    }
}

