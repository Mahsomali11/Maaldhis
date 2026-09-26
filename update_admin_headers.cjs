const fs = require('fs');
const path = require('path');

const directoryPath = 'resources/js/pages/admin';
const files = fs.readdirSync(directoryPath).filter(f => f.endsWith('.tsx'));

const titles = {
  "AdminAnalyticsPage.tsx": "Analytics",
  "AdminDashboardPage.tsx": "Platform Overview",
  "AdminExchangeRatesPage.tsx": "Exchange Rates",
  "AdminLicensesPage.tsx": "Licenses & Plans",
  "AdminMpesaSettingsPage.tsx": "M-Pesa Config",
  "AdminPaymentsPage.tsx": "Platform Payments",
  "AdminPlansPage.tsx": "Subscription Plans",
  "AdminSettingsPage.tsx": "System Settings",
  "AdminStoresPage.tsx": "Stores Management",
  "AdminSubscriptionsPage.tsx": "Subscriptions",
  "AdminSupportPage.tsx": "Support Tickets",
  "AdminUsersPage.tsx": "User Management"
};

for (const file of files) {
  if (!titles[file]) continue;

  const filePath = path.join(directoryPath, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Inject PageHeader import if not present
  if (!content.includes("import PageHeader")) {
    content = content.replace("import { useEffect", "import PageHeader from '@/components/PageHeader';\nimport { useEffect");
    if (!content.includes("import PageHeader")) {
       content = "import PageHeader from '@/components/PageHeader';\n" + content;
    }
  }

  // Find the exact Bespoke Header block
  const bespokeIndex = content.indexOf('{/* Bespoke Header */}');
  if (bespokeIndex !== -1) {
     // Find the start of the `<div className="bg-card border-b...`
     const headerDivStart = content.indexOf('<div className="bg-card', bespokeIndex);
     
     // Find the next major section container that signifies the end of the bespoke header
     const nextSectionStart = content.indexOf('<div className="max-w-7xl mx-auto px-4', headerDivStart);
     const altNextSection1 = content.indexOf('<div className="max-w-7xl mx-auto p-4', headerDivStart);
     const altNextSection2 = content.indexOf('<div className="px-4 sm:px-6', headerDivStart);
     
     let endOfHeader = -1;
     if (nextSectionStart !== -1) endOfHeader = nextSectionStart;
     else if (altNextSection1 !== -1) endOfHeader = altNextSection1;
     else if (altNextSection2 !== -1) endOfHeader = altNextSection2;
     else {
        // Find by div count? No, let's just find the first <div that isn't indented inside the header.
        const lines = content.substring(headerDivStart).split('\n');
        let divCount = 0;
        let foundEnd = false;
        let charCount = headerDivStart;
        for(let i=0; i<lines.length; i++) {
           const l = lines[i];
           if (l.includes('<div')) divCount += (l.match(/<div/g) || []).length;
           if (l.includes('</div')) divCount -= (l.match(/<\/div/g) || []).length;
           charCount += l.length + 1; // +1 for \n
           if (divCount === 0 && i > 0) {
              endOfHeader = charCount;
              break;
           }
        }
     }
     
     if (endOfHeader !== -1) {
       const before = content.substring(0, bespokeIndex - 1);
       const after = content.substring(endOfHeader);
       content = before + '\n      <PageHeader title="' + titles[file] + '" />\n      ' + after;
     }
  } else {
     // If no bespoke header, just inject PageHeader after return (
     // find return (
     const returnIndex = content.indexOf('return (');
     if (returnIndex !== -1) {
        const divIndex = content.indexOf('<div', returnIndex);
        if (divIndex !== -1) {
           const divEnd = content.indexOf('>', divIndex) + 1;
           const before = content.substring(0, divEnd);
           const after = content.substring(divEnd);
           content = before + '\n      <PageHeader title="' + titles[file] + '" />' + after;
        }
     }
  }

  // Remove `bg-[#F8F9FA] dark:bg-background min-h-screen`
  content = content.replace(/bg-\[\#F8F9FA\] dark:bg-background min-h-screen/g, '');

  fs.writeFileSync(filePath, content);
  console.log("Updated", file);
}
