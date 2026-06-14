export const zenithSalonConfig = {
  organizationName: 'Zenith Wellness Group',
  businessName: 'Zenith Salon & Spa',
  industryProfile: 'SERVICES',
  baseCurrency: 'INR',
  baseTimezone: 'Asia/Kolkata',
  branches: [
    {
      name: 'Zenith Salon Downtown',
      slug: 'zenith-salon-downtown',
      description: 'Downtown premium spa location',
      rulesConfig: {
        operatingHours: { startHour: 9, endHour: 20 },
        weekends: [1], // Salons are typically closed on Mondays (1 = Monday)
        lowStockThreshold: 3
      }
    }
  ],
  chartOfAccounts: [
    { code: '4001', name: 'Hair Services Revenue', type: 'REVENUE', color: 'var(--primary)' },
    { code: '4002', name: 'Spa & Facial Revenue', type: 'REVENUE', color: 'var(--chart-2)' },
    { code: '4003', name: 'Retail Product Sales', type: 'REVENUE', color: 'var(--chart-3)' },
    { code: '4004', name: 'Membership Recovered', type: 'REVENUE', color: 'var(--success)' },
    { code: '5001', name: 'Salon Rent & Utilities', type: 'OPEX', color: 'var(--destructive)' },
    { code: '5002', name: 'Staff Commission & Wages', type: 'OPEX', color: 'var(--warning)' }
  ],
  parserTemplates: [
    {
      templateName: 'Zenith Salon Excel Sales Template',
      fileCategory: 'sales',
      mappingSchema: {
        file_category: 'sales',
        header_row_index: 2,
        data_start_row: 3,
        columns: {
          date: { col_idx: 1, type: 'date' },
          invoice: { col_idx: 2, type: 'string' }
        },
        expansions: [
          { col_index: 3, type: 'credit', coa_code: '4001', default_vendor: 'Hair Styling Desk', default_particulars: 'Hair Services Revenue' },
          { col_index: 4, type: 'credit', coa_code: '4002', default_vendor: 'Spa Rooms', default_particulars: 'Spa & Facial Treatments' },
          { col_index: 5, type: 'credit', coa_code: '4003', default_vendor: 'Product Shelves', default_particulars: 'Retail Product Sales' },
          { col_index: 6, type: 'credit', coa_code: '4004', default_vendor: 'Memberships', default_particulars: 'Membership Subscription Recoveries' },
          { col_index: 7, type: 'debit', coa_code: '5001', default_vendor: 'Landlords', default_particulars: 'Rent and utility opex' },
          { col_index: 8, type: 'debit', coa_code: '5002', default_vendor: 'Staff Members', default_particulars: 'Stylist wages paid' }
        ]
      }
    },
    {
      templateName: 'Zenith Salon Excel Stock Template',
      fileCategory: 'inventory',
      mappingSchema: {
        file_category: 'inventory',
        data_start_row: 3,
        columns: {
          itemName: { col_idx: 1 },
          itemCode: { col_idx: 2 },
          category: { col_idx: 3 },
          unitOfMeasure: { col_idx: 4 },
          openingStock: { col_idx: 5 },
          stockIn: { col_idx: 6 },
          stockOut: { col_idx: 7 },
          closingStock: { col_idx: 8 },
          costPrice: { col_idx: 9 },
          sellingPrice: { col_idx: 10 }
        }
      }
    },
    {
      templateName: 'Zenith Salon Excel Debitors Template',
      fileCategory: 'receivables',
      mappingSchema: {
        file_category: 'receivables',
        breakup: {
          sheet_name: 'Breakup',
          data_start_row: 2,
          columns: {
            partyName: { col_idx: 1 },
            debit: { col_idx: 2 },
            credit: { col_idx: 3 },
            pending: { col_idx: 4 }
          }
        },
        entrylist: {
          sheet_name: 'EntryList',
          data_start_row: 5,
          columns: {
            partyName: { col_idx: 2 },
            date: { col_idx: 3 },
            debit: { col_idx: 4 },
            credit: { col_idx: 5 }
          }
        }
      }
    }
  ]
};
