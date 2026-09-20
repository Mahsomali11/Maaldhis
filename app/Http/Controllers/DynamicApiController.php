<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DynamicApiController extends Controller
{
    protected function getModelClass($table)
    {
        // Special cases
        if ($table === 'returns') return '\\App\\Models\\ReturnModel';
        if ($table === 'profiles') return '\\App\\Models\\User'; // Use users table for profiles
        
        $modelName = Str::studly(Str::singular($table));
        $class = '\\App\\Models\\' . $modelName;
        
        if (class_exists($class)) {
            return $class;
        }
        
        abort(404, "Model for table {$table} not found.");
    }

    public function index(Request $request, $table)
    {
        \Illuminate\Support\Facades\Log::info("DynamicAPI Index: $table", $request->all());
        $class = $this->getModelClass($table);
        $query = $class::query();

        $selectParam = $request->query('select', '*');
        
        // Handle relations in select e.g. "*, profiles!stores_owner_user_id_fkey(email, full_name)"
        if ($selectParam && $selectParam !== '*') {
            $relations = [];
            $selects = [];
            
            // We need a better split that doesn't split inside parentheses
            $parts = preg_split('/,\s*(?![^\(\)]*\))/', $selectParam);
            
            foreach ($parts as $part) {
                $part = trim($part);
                if ($part === '*' || $part === '') continue;
                
                if (preg_match('/^([a-zA-Z0-9_]+)(?:![^\(]+|:[^\(]+)?\((.*?)\)$/', $part, $matches)) {
                    $relation = $matches[1];
                    $cols = $matches[2];
                    $relations[$relation] = $cols;
                } else {
                    $selects[] = $part;
                }
            }
            
            if (!empty($selects)) {
                $query->select($selects);
            }
            
            foreach ($relations as $rel => $cols) {
                $query->with([$rel => function ($q) use ($cols) {
                    if ($cols && $cols !== '*') {
                        // Map columns, making sure we include the primary key 'id' for relation mapping
                        $colArr = array_map('trim', explode(',', $cols));
                        if (!in_array('id', $colArr)) {
                            $colArr[] = 'id';
                        }
                        $q->select($colArr);
                    }
                }]);
            }
        }

        // Apply filters from query params
        foreach ($request->all() as $key => $value) {
            if (in_array($key, ['select', 'order', 'limit', 'or', 'count', 'head'])) continue;
            
            // Format: field=eq.value
            if (is_string($value)) {
                $parsedValue = $value;
                $operator = '=';
                $isWhereIn = false;
                $inItems = [];
                
                if (str_starts_with($value, 'eq.')) {
                    $parsedValue = substr($value, 3);
                } elseif (str_starts_with($value, 'neq.')) {
                    $parsedValue = substr($value, 4);
                    $operator = '!=';
                } elseif (str_starts_with($value, 'in.')) {
                    $inItems = explode(',', trim(substr($value, 3), '()'));
                    $isWhereIn = true;
                }

                // Handle boolean strings
                if ($parsedValue === 'true') $parsedValue = true;
                if ($parsedValue === 'false') $parsedValue = false;
                if ($parsedValue === 'null') $parsedValue = null;

                if ($isWhereIn) {
                    $query->whereIn($key, $inItems);
                } else {
                    $query->where($key, $operator, $parsedValue);
                }
            }
        }

        if ($request->has('or')) {
            $orStr = $request->query('or');
            $parts = explode(',', $orStr);
            $query->where(function ($q) use ($parts) {
                foreach ($parts as $part) {
                    if (str_contains($part, '.eq.')) {
                        [$field, $val] = explode('.eq.', $part);
                        if ($val === 'true') $val = true;
                        if ($val === 'false') $val = false;
                        if ($val === 'null') $val = null;
                        $q->orWhere($field, $val);
                    }
                }
            });
        }

        if ($request->has('order')) {
            $orderParts = explode('.', $request->query('order'));
            $field = $orderParts[0];
            $direction = $orderParts[1] ?? 'asc';
            $query->orderBy($field, $direction);
        }

        $count = null;
        if ($request->has('count') && $request->query('count') === 'exact') {
            $count = $query->count();
            if ($request->has('head') && $request->query('head') === 'true') {
                return response()->json([], 200, ['Content-Range' => "0-0/$count"]);
            }
        }

        if ($request->has('limit')) {
            $query->limit($request->query('limit'));
        }

        $headers = [];
        if ($count !== null) {
            $headers['Content-Range'] = "0-0/$count";
        }

        return response()->json($query->get(), 200, $headers);
    }

    public function store(Request $request, $table)
    {
        $class = $this->getModelClass($table);

        // Use only JSON body data, or fallback to POST
        $body = $request->json()->all();
        if (empty($body)) {
            $body = $request->post();
        }

        if (is_array($body) && isset($body[0]) && is_array($body[0])) {
            // Bulk insert (array of objects)
            $data = $body;
            foreach ($data as &$item) {
                if (!isset($item['id'])) {
                    $item['id'] = (string) Str::uuid();
                }
            }
            $class::insert($data);
            return response()->json($data, 201);
        }

        // Single insert
        if (!isset($body['id'])) {
            $body['id'] = (string) Str::uuid();
        }
        $record = $class::create($body);
        return response()->json($record, 201);
    }

    public function show($table, $id)
    {
        $class = $this->getModelClass($table);
        return response()->json($class::findOrFail($id));
    }

    public function update(Request $request, $table, $id = null)
    {
        $class = $this->getModelClass($table);

        // Use only JSON body data, or fallback to POST
        $body = $request->json()->all();
        if (empty($body)) {
            $body = $request->post();
        }

        if ($id) {
            $record = $class::findOrFail($id);
            $record->update($body);
            return response()->json($record);
        }
        
        $query = $class::query();
        $filtered = false;
        foreach ($request->query() as $key => $value) {
            if (in_array($key, ['select', 'order', 'limit', 'count', 'head'])) continue;
            if (is_string($value) && str_starts_with($value, 'eq.')) {
                $val = substr($value, 3);
                if ($val === 'true') $val = true;
                if ($val === 'false') $val = false;
                if ($val === 'null') $val = null;
                $query->where($key, $val);
                $filtered = true;
            }
        }
        
        if ($filtered) {
            $query->update($body);
            return response()->json(['success' => true]);
        }
        
        return response()->json(['error' => 'Missing ID or filter for update'], 400);
    }

    public function destroy(Request $request, $table, $id = null)
    {
        $class = $this->getModelClass($table);
        
        if ($id) {
            $record = $class::findOrFail($id);
            $record->delete();
            return response()->json(null, 204);
        }
        
        $query = $class::query();
        $filtered = false;
        foreach ($request->query() as $key => $value) {
            if (is_string($value) && str_starts_with($value, 'eq.')) {
                $val = substr($value, 3);
                if ($val === 'true') $val = true;
                if ($val === 'false') $val = false;
                if ($val === 'null') $val = null;
                $query->where($key, $val);
                $filtered = true;
            } elseif (is_string($value) && str_starts_with($value, 'in.')) {
                $items = explode(',', trim(substr($value, 3), '()'));
                $query->whereIn($key, $items);
                $filtered = true;
            }
        }
        
        if ($filtered) {
            $query->delete();
            return response()->json(null, 204);
        }
        
        return response()->json(['error' => 'Missing ID or filter for delete'], 400);
    }
}
