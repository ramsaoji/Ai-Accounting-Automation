export const hotelGauravConfig = {
  organizationName: 'Gaurav Enterprises',
  businessName: 'Hotel Gaurav',
  industryProfile: 'HOSPITALITY',
  baseCurrency: 'INR',
  baseTimezone: 'Asia/Kolkata',
  branches: [
    {
      name: 'Hotel Gaurav Main',
      slug: 'hotel-gaurav-main',
      description: 'Main sales register and debtors branch',
      rulesConfig: {
        operatingHours: { startHour: 8, endHour: 23 },
        weekends: [] // Wine bar open daily, no weekends
      }
    },
    {
      name: 'Hotel Gaurav Godown',
      slug: 'hotel-gaurav-godown',
      description: 'Stock storage and warehouse branch',
      rulesConfig: {
        lowStockThreshold: 10
      }
    }
  ],
  chartOfAccounts: [
    { code: '4001', name: 'Liquor Sales Revenue', type: 'REVENUE', color: 'var(--chart-2)' },
    { code: '4002', name: 'Food Sales Revenue', type: 'REVENUE', color: 'var(--primary)' },
    { code: '4003', name: 'Credit Recovery (Udhari Recovery)', type: 'REVENUE', color: 'var(--success)' },
    { code: '5001', name: 'Operational Expenses', type: 'OPEX', color: 'var(--destructive)' },
    { code: '5002', name: 'Credit Extended (Udhari Extended)', type: 'OPEX', color: 'var(--warning)' }
  ],
  parserTemplates: [
    {
      templateName: 'Hotel Gaurav Daily Sales Template',
      fileCategory: 'sales',
      mappingSchema: {
        header_row_index: 3,
        data_start_row: 4,
        columns: {
          date: { col_idx: 2, type: 'date' },
          invoice: { col_idx: 1, type: 'string' }
        },
        expansions: [
          { col_index: 4, type: 'credit', coa_code: '4001', default_vendor: 'Bar Counter', default_particulars: 'Daily Counter Liquor Sales' },
          { col_index: 5, type: 'credit', coa_code: '4002', default_vendor: 'Restaurant Counter', default_particulars: 'Daily Restaurant Food Sales' },
          { col_index: 6, type: 'credit', coa_code: '4003', default_vendor: 'Customer Debtors', default_particulars: 'Outstanding customer dues recovered (Udhari Jama)' },
          { col_index: 10, type: 'debit', coa_code: '5001', default_vendor: 'Supplier Vendors', default_particulars: 'Daily operational purchases and wages' },
          { col_index: 8, type: 'debit', coa_code: '5002', default_vendor: 'Customer Debtors', default_particulars: 'Meals and beverages served on credit (Udhari Given)' }
        ]
      }
    }
  ]
};
