import { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { HelpCircle, Mail, MessageCircle, Info, ChevronDown, ChevronUp, Phone, Globe, Shield, AlertTriangle, Smartphone, RefreshCw } from 'lucide-react';

const faqs = [
  {
    category: 'Account & Login',
    questions: [
      { q: 'How do I reset my password?', a: 'Go to the login screen and tap "Forgot password". Enter your email address and we\'ll send you a reset link. Click the link in your email to set a new password.' },
      { q: 'How do I create a new account?', a: 'On the login screen, tap "Create an account". Fill in your email, password, and business phone number. After creating your account, you\'ll be guided to set up your first store.' },
      { q: 'Can I use the same account for multiple stores?', a: 'Yes! One account can manage multiple stores. Use "Switch account" in the side menu to switch between your stores. Each store has its own isolated data.' },
      { q: 'How do I delete my account?', a: 'Open the side menu and tap "Delete your account" at the bottom. This action is permanent and will delete all your data. You\'ll be asked to confirm before proceeding.' },
    ],
  },
  {
    category: 'Sales & Payments',
    questions: [
      { q: 'How do I process a sale?', a: 'Tap "START SALE" on the Dashboard. Search or scan items, add them to the cart, then tap Checkout. Choose the sale type (Cash/Credit/Mixed), payment method, and tap "Complete Sale".' },
      { q: 'What payment methods are supported?', a: 'Nasri Point supports Cash, M-Pesa (digital wallet), and Card payments. You can configure available payment methods in Preferences.' },
      { q: 'How do credit sales work?', a: 'Choose "Credit" or "Mixed" as the sale type during checkout. Select the customer and enter any amount paid now. The remaining balance is recorded as customer debt and can be collected later.' },
      { q: 'How do I collect customer payments?', a: 'Go to Credit Record → Customers Debt. Find the customer and tap to collect payment. Enter the amount and payment method. The debt balance updates automatically.' },
      { q: 'Can I void or cancel a sale?', a: 'Currently, you can process returns for completed sales. Go to Returns, search by receipt ID, and select items to return. The inventory and reports will be updated accordingly.' },
    ],
  },
  {
    category: 'Inventory & Stock',
    questions: [
      { q: 'What\'s the difference between Products and Services?', a: 'Products have physical stock that gets deducted when sold. Services (like repairs) don\'t have stock quantities — they can be sold unlimited times without affecting inventory.' },
      { q: 'How do I set low stock alerts?', a: 'When adding or editing an item, set the "Low Stock Threshold". Items below this quantity will appear in red in your inventory, making them easy to spot.' },
      { q: 'How do stock transfers work?', a: 'Stock Transfers let you move inventory between your stores. Create a transfer, select items and quantities, and submit. Stock is deducted from the source and added to the destination once received.' },
      { q: 'How is profit calculated?', a: 'Profit per item = (Sell Price – Cost Price) × Quantity Sold. Net Profit = Total Gross Profit – Expenses – Losses. All calculations are based on actual transaction data.' },
    ],
  },
  {
    category: 'Reports & Data',
    questions: [
      { q: 'What reports are available?', a: 'Sales Report (daily/monthly/all-time), Stock Report (inventory movements), Cash Flow (money in and out), Receipt History (searchable by date), and Expense tracking.' },
      { q: 'Can I export my data?', a: 'Yes! In the Inventory section, tap the export/download button to generate a report. Receipt History also supports exporting and sharing individual receipts.' },
      { q: 'How is Net Profit calculated?', a: 'Net Profit = Gross Sales Profit + Gross Credit Profit – Total Expenses – Total Losses. This gives you the true profitability of your business for any time period.' },
    ],
  },
  {
    category: 'Troubleshooting',
    questions: [
      { q: 'The app is running slowly. What should I do?', a: 'Try clearing your browser cache and refreshing the page. If you have a large inventory, use the search feature instead of scrolling through all items.' },
      { q: 'I can\'t scan barcodes. What\'s wrong?', a: 'Make sure you\'ve allowed camera access in your browser settings. The barcode scanner works best in good lighting. You can always enter barcodes manually as a fallback.' },
      { q: 'My data seems incorrect. What should I check?', a: 'Verify that all items have correct cost and sell prices. Check that returns and voided sales are properly recorded. Review your expense entries for the period in question.' },
      { q: 'I accidentally deleted something. Can I undo it?', a: 'Deleted items cannot be recovered in the current version. We recommend being careful with delete actions. Future updates will include a recycle bin feature.' },
    ],
  },
];

export default function HelpPage() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Account & Login');
  const [expandedQ, setExpandedQ] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background pb-8">
      <PageHeader title="Help" />
      <div className="px-4 py-4 space-y-4">
        {/* Quick Actions */}
        <div className="bg-card rounded-xl p-4">
          <h3 className="font-bold text-foreground mb-3">Need Help?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Browse the FAQ below or contact our support team directly.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <a href="mailto:support@nasripoint.com" className="flex flex-col items-center gap-2 bg-accent/50 rounded-xl p-4 active:scale-[0.98] transition-transform">
              <Mail size={24} className="text-info" />
              <span className="text-sm font-medium text-foreground">Email Us</span>
            </a>
            <a href="https://wa.me/254700000000" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 bg-accent/50 rounded-xl p-4 active:scale-[0.98] transition-transform">
              <MessageCircle size={24} className="text-success" />
              <span className="text-sm font-medium text-foreground">WhatsApp</span>
            </a>
          </div>
        </div>

        {/* FAQ Sections */}
        <h3 className="font-bold text-foreground">Frequently Asked Questions</h3>
        {faqs.map(section => (
          <div key={section.category} className="bg-card rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedCategory(expandedCategory === section.category ? null : section.category)}
              className="w-full p-4 flex items-center justify-between"
            >
              <h4 className="font-bold text-foreground">{section.category}</h4>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full">
                  {section.questions.length}
                </span>
                {expandedCategory === section.category ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
              </div>
            </button>
            {expandedCategory === section.category && (
              <div className="px-4 pb-4 space-y-2">
                {section.questions.map((faq, i) => (
                  <div key={i} className="border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedQ(expandedQ === faq.q ? null : faq.q)}
                      className="w-full px-3 py-3 flex items-start gap-2 text-left"
                    >
                      <HelpCircle size={16} className="text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm font-medium text-foreground flex-1">{faq.q}</span>
                      {expandedQ === faq.q ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                    </button>
                    {expandedQ === faq.q && (
                      <div className="px-3 pb-3 ml-6">
                        <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Contact Support */}
        <div className="bg-card rounded-xl p-4 space-y-3">
          <h3 className="font-bold text-foreground">Contact Support</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail size={20} className="text-info" />
              <div>
                <p className="text-sm font-medium text-foreground">Email</p>
                <p className="text-sm text-muted-foreground">support@nasripoint.com</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone size={20} className="text-success" />
              <div>
                <p className="text-sm font-medium text-foreground">Phone</p>
                <p className="text-sm text-muted-foreground">+254 700 000 000</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MessageCircle size={20} className="text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">WhatsApp</p>
                <p className="text-sm text-muted-foreground">+254 700 000 000</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Globe size={20} className="text-warning" />
              <div>
                <p className="text-sm font-medium text-foreground">Website</p>
                <p className="text-sm text-muted-foreground">www.nasripoint.com</p>
              </div>
            </div>
          </div>
        </div>

        {/* App Info */}
        <div className="bg-card rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Info size={20} className="text-muted-foreground" />
            <div>
               <p className="text-sm font-medium text-foreground">Nasri Point POS</p>
               <p className="text-xs text-muted-foreground">Version 1.0.0 • © 2026 Nasri Point</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
