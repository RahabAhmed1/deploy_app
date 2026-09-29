export function buildInvoiceHtml(inv: any, ord: any | undefined, company: any, customers: any[]) {
  const numberToWordsIndian = (num: number) => {
    const a = [
      '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
      'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'
    ];
    const b = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

    const inWords2 = (n: number) => {
      if (n < 20) return a[n];
      const tens = Math.floor(n / 10);
      const ones = n % 10;
      return `${b[tens]}${ones ? ` ${a[ones]}` : ''}`.trim();
    };

    const inWords3 = (n: number) => {
      const h = Math.floor(n / 100);
      const r = n % 100;
      const head = h ? `${a[h]} HUNDRED` : '';
      const rest = r ? `${head ? ' ' : ''}${inWords2(r)}` : head;
      return rest.trim();
    };

    const n = Math.floor(Number(num) || 0);
    if (n === 0) return 'ZERO';
    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const hundred = n % 1000;

    const parts: string[] = [];
    if (crore) parts.push(`${inWords3(crore)} CRORE`);
    if (lakh) parts.push(`${inWords3(lakh)} LAKH`);
    if (thousand) parts.push(`${inWords3(thousand)} THOUSAND`);
    if (hundred) parts.push(`${inWords3(hundred)}`);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  };

  const amountInWords = (amount: number) => {
    const v = Number(amount || 0);
    const rupees = Math.floor(v);
    const paise = Math.round((v - rupees) * 100);
    const rupeeWords = `${numberToWordsIndian(rupees)} RUPEES`;
    const paiseWords = paise ? ` AND ${numberToWordsIndian(paise)} PAISE` : '';
    return `${rupeeWords}${paiseWords} ONLY`;
  };

  const headerName = (company?.companyName || 'PharmaFlow Pro');
  const addressLine = [company?.address, company?.city, company?.state, company?.pinCode].filter(Boolean).join(', ');
  const idLine = [company?.gstNo ? `GST: ${company.gstNo}` : '', company?.drugLicenseNo ? `DL: ${company.drugLicenseNo}` : '', company?.fssaiLicense ? `FSSAI: ${company.fssaiLicense}` : ''].filter(Boolean).join(' | ');
  const contactLine = [company?.phone ? `Ph: ${company.phone}` : '', company?.email || ''].filter(Boolean).join(' • ');

  const cust = (customers || []).find((c: any) => String(c.id) === String(ord?.customerId));
  const custIdLine = [cust?.customerNo ? `ID: ${cust.customerNo}` : '', cust?.gstNo ? `GST: ${cust.gstNo}` : '', cust?.drugLicenseNo ? `DL: ${cust.drugLicenseNo}` : ''].filter(Boolean).join(' | ');
  const custContactLine = [cust?.contactPerson ? `Contact: ${cust.contactPerson}` : '', cust?.phone ? `Ph: ${cust.phone}` : '', cust?.email || ''].filter(Boolean).join(' • ');
  const custAddrLine = [cust?.address, cust?.city, cust?.state].filter(Boolean).join(', ');

  const salesmanLine = [ord?.salesmanName ? `Salesman: ${ord.salesmanName}` : '', ord?.salesmanCode ? `(${ord.salesmanCode})` : ''].filter(Boolean).join(' ');

  const subTotal = Number((ord?.totalAmount ?? inv.amount) || 0);
  const discountAmt = Number((ord?.discountAmount ?? inv.discount) || 0);
  const taxAmt = Number((ord?.taxAmount ?? inv.tax) || 0);
  const grandTotal = Number((ord?.netAmount ?? inv.total) || 0);

  const items = (ord?.items || []).map((it: any, idx: number) => {
    const qty = Number(it.quantity || 0);
    const rate = Number(it.unitPrice || 0);
    const discPct = Number(it.discount || 0);
    const taxPct = Number(it.tax || 0);
    const amount = Number(it.total || 0);
    return {
      idx,
      qty,
      productName: it.productName || '',
      batchNo: it.batchNo || '-',
      rate,
      discPct,
      taxPct,
      amount,
    };
  });

  const itemsRows = items
    .map((it: any) => `
          <tr>
            <td class="center">${it.idx + 1}</td>
            <td>${it.productName}</td>
            <td class="center">${it.batchNo}</td>
            <td class="right">${it.qty}</td>
            <td class="right">${it.rate.toFixed(2)}</td>
            <td class="right">${it.discPct.toFixed(2)}%</td>
            <td class="right">${it.taxPct.toFixed(2)}%</td>
            <td class="right">${it.amount.toFixed(2)}</td>
          </tr>
        `)
    .join('');

  const totalItems = items.length;
  const grossTotal = subTotal;
  const discTotal = discountAmt;
  const stTotal = taxAmt;
  const netReceivable = grandTotal;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${inv.invoiceNo}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
        body { margin: 0; font-family: Inter, Arial, Helvetica, sans-serif; color: #000; background: #fff; }
        .wrap { width: 100%; min-height: 277mm; display: flex; flex-direction: column; }
        .content { flex: 1; }
        .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
        .h1 { font-size: 18px; font-weight: 700; line-height: 1.1; }
        .muted { font-size: 11px; line-height: 1.35; }
        .meta { font-size: 11px; width: 260px; }
        .meta table { width: 100%; border-collapse: collapse; }
        .meta td { padding: 2px 0; vertical-align: top; }
        .title { text-align: center; font-weight: 700; font-size: 14px; letter-spacing: 1px; margin: 10px 0 8px; }
        .hr { border-top: 1px solid #000; margin: 8px 0; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .box { border: 1px solid #000; padding: 8px; min-height: 70px; }
        .box h3 { margin: 0 0 6px; font-size: 11px; letter-spacing: .6px; text-transform: uppercase; }
        .row { display: flex; gap: 10px; }
        .k { font-weight: 600; }
        table.items { width: 100%; border-collapse: collapse; margin-top: 10px; }
        table.items th, table.items td { border: 1px solid #000; padding: 6px 6px; font-size: 11px; }
        table.items th { text-transform: uppercase; font-size: 10px; letter-spacing: .4px; }
        .right { text-align: right; }
        .center { text-align: center; }
        .totals { margin-top: 10px; display: grid; grid-template-columns: 1fr 260px; gap: 10px; }
        .totals .note { font-size: 11px; }
        .totals table { width: 100%; border-collapse: collapse; border-top: 1px solid #000; }
        .totals td { padding: 6px 0; font-size: 11px; border-bottom: 1px solid #000; }
        .totals tr:last-child td { border-bottom: none; }
        .totals .grand { border-top: 1px solid #000; padding-top: 8px; font-weight: 700; }
        .footer { margin-top: auto; padding-top: 14px; display: flex; justify-content: space-between; gap: 12px; font-size: 11px; page-break-inside: avoid; }
        .sign { text-align: right; }
        .signline { border-top: 1px solid #000; margin: 22px 0 6px; }
        </style>
      </head>
      <body onload="window.print(); setTimeout(()=>window.close(), 300);">
        <div class="wrap">
          <div class="content">
          <div class="top">
            <div>
              <div class="h1">${headerName}</div>
              ${addressLine ? `<div class="muted">${addressLine}</div>` : ''}
              ${contactLine ? `<div class="muted">${contactLine}</div>` : ''}
              ${idLine ? `<div class="muted">${idLine}</div>` : ''}
            </div>
            <div class="meta">
              <table>
                <tr><td class="k">Invoice No</td><td class="right">${inv.invoiceNo}</td></tr>
                <tr><td class="k">Invoice Date</td><td class="right">${inv.date}</td></tr>
                <tr><td class="k">Order No</td><td class="right">${ord?.orderNo || '-'}</td></tr>
                <tr><td class="k">Order Date</td><td class="right">${ord?.orderDate || ''}</td></tr>
                <tr><td class="k">Due Date</td><td class="right">${inv.dueDate || ''}</td></tr>
              </table>
            </div>
          </div>

          <div class="title">INVOICE</div>
          <div class="hr"></div>

          <div class="grid">
            <div class="box">
              <h3>Bill To</h3>
              <div class="muted"><span class="k">Customer:</span> ${inv.customer || ''}</div>
              ${custAddrLine ? `<div class="muted"><span class="k">Address:</span> ${custAddrLine}</div>` : ''}
              ${custContactLine ? `<div class="muted">${custContactLine}</div>` : ''}
              ${custIdLine ? `<div class="muted">${custIdLine}</div>` : ''}
            </div>
            <div class="box">
              <h3>Sales Details</h3>
              <div class="muted"><span class="k">Customer Type:</span> ${inv.customerType || ''}</div>
              <div class="muted"><span class="k">Salesman:</span> ${salesmanLine || ''}</div>
              <div class="muted"><span class="k">Total Items:</span> ${totalItems}</div>
            </div>
          </div>

          <table class="items">
            <thead>
              <tr>
                <th style="width:6%" class="center">#</th>
                <th style="width:40%">Product</th>
                <th style="width:14%" class="center">Batch</th>
                <th style="width:8%" class="right">Qty</th>
                <th style="width:10%" class="right">Rate</th>
                <th style="width:8%" class="right">Disc</th>
                <th style="width:8%" class="right">Tax</th>
                <th style="width:16%" class="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows || ''}
            </tbody>
          </table>

          <div class="totals">
            <div class="note">
              <div><span class="k">In Words:</span> ${amountInWords(grandTotal)}</div>
            </div>
            <div>
              <table>
                <tr><td>Subtotal</td><td class="right">${grossTotal.toFixed(2)}</td></tr>
                <tr><td>Discount</td><td class="right">${discTotal.toFixed(2)}</td></tr>
                <tr><td>Tax</td><td class="right">${stTotal.toFixed(2)}</td></tr>
                <tr><td class="grand">Grand Total</td><td class="right grand">${netReceivable.toFixed(2)}</td></tr>
              </table>
            </div>
          </div>

          </div>

          <div class="footer">
            <div>Printed On: ${new Date().toISOString().slice(0,10)}</div>
            <div class="sign">For ${headerName}<div class="signline"></div>Authorized Signatory</div>
          </div>
        </div>
      </body></html>`;
  return html;
}
