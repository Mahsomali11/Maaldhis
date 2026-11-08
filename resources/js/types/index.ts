// Types for the Maaldhis POS system
export interface Category {
  id: string;
  store_id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  created_at: string;
}

export interface Store {
  id: string;
  owner_user_id: string;
  store_name: string;
  store_code: string;
  location: string;
  phone: string;
  currency: string;
  logo_url: string;
  show_logo_on_receipt: boolean;
  receipt_thank_you_message: string;
  receipt_footer_text: string;
  receipt_template?: string;
  primary_color?: string;
  secondary_color?: string;
  country?: string;
  tax_enabled?: boolean;
  tax_rate?: number;
  low_stock_threshold?: number;
  business_type?: 'standard_retail' | 'grocery_bulk' | 'dental_clinic';
  created_at: string;
}

export interface StoreUser {
  id: string;
  store_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'cashier' | 'inventory_manager';
  is_active: boolean;
}

export interface Customer {
  id: string;
  store_id: string;
  customer_code: string;
  name: string;
  phone: string;
  address: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  store_id: string;
  supplier_code: string;
  name: string;
  phone: string;
  address: string;
  created_at: string;
}

export interface Item {
  id: string;
  store_id: string;
  item_code: string;
  name: string;
  category: string;
  sub_category_id?: string | null;
  sub_category?: Category | null;
  type: 'product' | 'service';
  barcode: string;
  cost_price: number;
  sell_price: number;
  quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  is_service?: boolean;
  image_path?: string;
  allow_decimal_qty?: boolean;
  base_unit?: string | null;
  wholesale_unit?: string | null;
  conversion_factor?: number;
  wholesale_price?: number | null;
  retail_price?: number | null;
  created_at: string;
}

export interface Sale {
  id: string;
  store_id: string;
  receipt_no: string;
  customer_id: string | null;
  staff_user_id: string;
  sale_type: 'cash' | 'credit' | 'mixed';
  subtotal: number;
  discount: number;
  tax: number;
  tax_rate?: number;
  total: number;
  paid_amount: number;
  outstanding_amount: number;
  status: 'completed' | 'voided' | 'returned';
  payment_account_id?: string | null;
  sold_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  item_id: string;
  item_name?: string;
  quantity: number;
  cost_price: number;
  sell_price: number;
  line_total: number;
}

export interface Payment {
  id: string;
  store_id: string;
  sale_id: string | null;
  customer_id: string | null;
  supplier_id: string | null;
  payment_type: string;
  direction: 'in' | 'out';
  method: 'cash' | 'mpesa' | 'card' | 'bank' | 'other';
  payment_account_id?: string | null;
  amount: number;
  reference: string;
  created_by: string;
  created_at: string;
  user?: { name?: string; full_name?: string };
}

export interface Expense {
  id: string;
  store_id: string;
  expense_type: string;
  amount: number;
  status?: 'active' | 'reversed';
  refund_amount?: number;
  refund_reason?: string | null;
  refunded_at?: string | null;
  refunded_by?: string | null;
  note: string;
  employee_user_id: string | null;
  employee_name?: string;
  supplier_id?: string | null;
  payment_method: string;
  payment_account_id?: string | null;
  created_by: string;
  created_at: string;
  user?: { name?: string; full_name?: string };
  refunder?: { name?: string; full_name?: string };
}

export interface Return {
  id: string;
  store_id: string;
  sale_id: string;
  processed_by: string;
  refund_method: string;
  refund_amount: number;
  created_at: string;
  items?: ReturnItem[];
}

export interface ReturnItem {
  id: string;
  return_id: string;
  sale_item_id: string;
  item_id: string;
  quantity: number;
  amount: number;
}

export interface CashSession {
  id: string;
  store_id: string;
  business_date: string;
  opening_cash: number;
  closing_cash: number;
  opened_by: string;
  closed_by: string | null;
  created_at: string;
}

export interface CashMovement {
  id: string;
  store_id: string;
  cash_session_id: string;
  movement_type: string;
  direction: 'in' | 'out';
  amount: number;
  source_module: string;
  reference_id: string;
  note: string;
  created_at: string;
}

export interface StockTransfer {
  id: string;
  source_store_id: string;
  destination_store_id: string;
  status: 'pending' | 'approved' | 'received' | 'cancelled';
  requested_by: string;
  approved_by: string | null;
  received_by: string | null;
  created_at: string;
  items?: StockTransferItem[];
}

export interface StockTransferItem {
  id: string;
  stock_transfer_id: string;
  item_id: string;
  quantity: number;
}

export interface CustomerDebt {
  id: string;
  store_id: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  sale_id: string | null;
  original_amount: number;
  balance_amount: number;
  status: 'open' | 'partial' | 'paid';
  notes?: string | null;
  created_at: string;
}

export interface CartItem {
  item: Item;
  quantity: number;
  line_total: number;
  unit_type?: 'retail' | 'wholesale';
  unit_name?: string;
  unit_price?: number;
  conversion_factor?: number;
  base_quantity?: number;
}

export interface StaffAccount {
  id: string;
  user_id?: string | null;
  store_id: string;
  full_name: string;
  email: string;
  phone: string;
  role: 'owner' | 'admin' | 'cashier' | 'inventory_manager' | 'dentist' | 'receptionist' | 'clinic_admin' | 'dental_doctor' | 'billing_clerk' | string;
  is_active: boolean;
  created_at: string;
}

export interface Purchase {
  id: string;
  store_id: string;
  reference_no: string;
  supplier_id: string | null;
  user_id: string | null;
  date: string;
  total_amount: number;
  paid_amount: number;
  payment_account_id: string | null;
  status: 'pending' | 'completed' | 'returned' | 'Pending' | 'Completed' | 'Returned';
  notes?: string;
  created_at: string;
  items?: PurchaseItem[];
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  item_id: string;
  quantity: number;
  cost_price: number;
  subtotal: number;
  unit_type?: 'base' | 'wholesale';
  unit_name?: string | null;
  conversion_factor?: number;
  base_quantity?: number | null;
  returned_quantity?: number;
  returned_base_quantity?: number;
}

export interface Patient {
  id: string;
  store_id: string;
  patient_code?: string;
  full_name: string;
  phone?: string;
  email?: string;
  gender?: string;
  age?: number | null;
  date_of_birth?: string | null;
  address?: string;
  blood_group?: string;
  allergies?: string;
  medical_history?: string;
  dental_history?: string;
  notes?: string;
  created_at: string;
  invoices?: DentalTreatment[];
  treatments?: DentalTreatment[];
  appointments?: Appointment[];
  dentalCharts?: DentalChartEntry[];
  dental_charts?: DentalChartEntry[];
  payments?: any[];
}

export interface Appointment {
  id: string;
  store_id: string;
  patient_id?: string | null;
  patient_name: string;
  patient_phone?: string;
  doctor_id?: string | null;
  doctor_name?: string;
  service_id?: string | null;
  appointment_date: string;
  appointment_time?: string;
  duration_minutes?: number;
  reason?: string;
  status: 'scheduled' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  created_by?: string | null;
  created_at: string;
}

export interface Doctor {
  id: string;
  store_id: string;
  staff_account_id?: string | null;
  user_id?: string | null;
  name: string;
  specialization: string;
  phone?: string;
  email?: string;
  working_hours?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface DentalChartEntry {
  id: string;
  store_id: string;
  patient_id: string;
  tooth_number: number;
  tooth_name?: string;
  condition_status: 'healthy' | 'caries' | 'filled' | 'crown' | 'root_canal' | 'missing' | 'extraction_needed' | 'implant';
  surface?: string;
  diagnosis?: string;
  treatment_plan?: string;
  notes?: string;
  updated_by?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface TreatmentLineItem {
  id: string;
  type: 'service' | 'product';
  item_id?: string;
  name: string;
  category?: string;
  tooth_number?: string;
  unit_price: number;
  quantity: number;
  total: number;
  current_stock?: number;
}

export interface DentalTreatment {
  id: string;
  store_id: string;
  patient_id?: string | null;
  patient_name: string;
  appointment_id?: string | null;
  invoice_no?: string;
  tooth_numbers?: string;
  procedure_name: string;
  category?: string;
  diagnosis?: string;
  prescription?: string;
  doctor_name?: string;
  cost: number;
  discount: number;
  total_amount: number;
  paid_amount: number;
  balance_amount: number;
  payment_status: 'paid' | 'partial' | 'unpaid';
  payment_method?: string;
  payment_account_id?: string | null;
  status: 'planned' | 'in_progress' | 'completed';
  notes?: string;
  items_detail?: TreatmentLineItem[];
  performed_at?: string;
  created_by?: string | null;
  created_at: string;
}
