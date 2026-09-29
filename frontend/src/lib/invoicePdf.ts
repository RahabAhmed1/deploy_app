import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function numberToWordsIndian(num: number) {
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
}

function amountInWords(amount: number) {
  const v = Number(amount || 0);
  const rupees = Math.floor(v);
  const paise = Math.round((v - rupees) * 100);
  const rupeeWords = `${numberToWordsIndian(rupees)} RUPEES`;
  const paiseWords = paise ? ` AND ${numberToWordsIndian(paise)} PAISE` : '';
  return `${rupeeWords}${paiseWords} ONLY`;
}

export function buildInvoicePdfDoc(inv: any, ord: any, company: any, customers: any[]) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const cust = (customers || []).find((c: any) => String(c.id) === String(ord?.customerId));

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(String(company?.companyName || 'PharmaFlow Pro'), 10, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const compLine1 = [company?.address, company?.city, company?.state, company?.pinCode].filter(Boolean).join(', ');
  const compLine2 = [company?.phone ? `Ph: ${company.phone}` : '', company?.email || ''].filter(Boolean).join(' | ');
  const compLine3 = [company?.gstNo ? `GST: ${company.gstNo}` : '', company?.drugLicenseNo ? `DL: ${company.drugLicenseNo}` : '', company?.fssaiLicense ? `FSSAI: ${company.fssaiLicense}` : ''].filter(Boolean).join(' | ');
  if (compLine1) doc.text(compLine1, 10, 19);
  if (compLine2) doc.text(compLine2, 10, 23);
  if (compLine3) doc.text(compLine3, 10, 27);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('INVOICE', pageW / 2, 35, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const rightX = pageW - 10;
  doc.text(`Invoice No: ${inv.invoiceNo}`, rightX, 14, { align: 'right' });
  doc.text(`Invoice Date: ${inv.date}`, rightX, 18, { align: 'right' });
  doc.text(`Order No: ${ord.orderNo || '-'}`, rightX, 22, { align: 'right' });
  doc.text(`Order Date: ${ord.orderDate || ''}`, rightX, 26, { align: 'right' });
  doc.text(`Due Date: ${inv.dueDate || ''}`, rightX, 30, { align: 'right' });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.line(10, 38, pageW - 10, 38);

  const billToY = 44;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Bill To', 10, billToY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(String(inv.customer || ''), 10, billToY + 5);
  const addr = [cust?.address, cust?.city, cust?.state].filter(Boolean).join(', ');
  if (addr) doc.text(doc.splitTextToSize(addr, pageW - 20), 10, billToY + 10);
  const line3 = [cust?.phone ? `Ph: ${cust.phone}` : '', cust?.email || ''].filter(Boolean).join(' | ');
  if (line3) doc.text(line3, 10, billToY + 19);
  const line4 = [cust?.customerNo ? `ID: ${cust.customerNo}` : '', cust?.gstNo ? `GST: ${cust.gstNo}` : '', cust?.drugLicenseNo ? `DL: ${cust.drugLicenseNo}` : ''].filter(Boolean).join(' | ');
  if (line4) doc.text(line4, 10, billToY + 24);

  doc.setFont('helvetica', 'bold');
  doc.text('Sales Details', rightX, billToY, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Type: ${inv.customerType || ''}`, rightX, billToY + 5, { align: 'right' });
  doc.text(`Salesman: ${ord.salesmanName || ''}${ord.salesmanCode ? ` (${ord.salesmanCode})` : ''}`, rightX, billToY + 10, { align: 'right' });
  doc.text(`Total Items: ${(ord.items || []).length}`, rightX, billToY + 15, { align: 'right' });

  const startY = 72;
  const rows = (ord.items || []).map((it: any, idx: number) => [
    String(idx + 1),
    String(it.productName || ''),
    String(it.batchNo || '-'),
    String(it.quantity ?? ''),
    Number(it.unitPrice || 0).toFixed(2),
    `${Number(it.discount || 0).toFixed(2)}%`,
    `${Number(it.tax || 0).toFixed(2)}%`,
    Number(it.total || 0).toFixed(2),
  ]);

  autoTable(doc, {
    startY,
    head: [[
      '#', 'Product', 'Batch', 'Qty', 'Rate', 'Disc', 'Tax', 'Amount'
    ]],
    body: rows,
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.0, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    theme: 'grid',
    margin: { left: 10, right: 10 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 70 },
      2: { halign: 'center', cellWidth: 25 },
      3: { halign: 'right', cellWidth: 14 },
      4: { halign: 'right', cellWidth: 18 },
      5: { halign: 'right', cellWidth: 18 },
      6: { halign: 'right', cellWidth: 18 },
      7: { halign: 'right', cellWidth: 25 },
    },
  });

  const afterY = (doc as any).lastAutoTable?.finalY ? Number((doc as any).lastAutoTable.finalY) : startY + 40;
  const bottomTotalsY = pageH - 62;
  const wordsY = bottomTotalsY - 10;
  if (afterY > wordsY - 6) {
    doc.addPage();
  }

  const xR = pageW - 10;
  const xL = xR - 72;
  const totalsY = doc.internal.pageSize.getHeight() - 62;
  const wY = totalsY - 10;

  const subtotal = Number(ord.totalAmount || 0);
  const disc = Number(ord.discountAmount || 0);
  const tax = Number(ord.taxAmount || 0);
  const total = Number(ord.netAmount || inv.total || 0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`In Words: ${amountInWords(Number(ord.netAmount || inv.total || 0))}`, 10, wY);

  doc.setLineWidth(0.2);
  doc.setDrawColor(0, 0, 0);
  doc.line(xL, totalsY - 3, xR, totalsY - 3);

  const r1 = totalsY;
  const r2 = totalsY + 6;
  const r3 = totalsY + 12;
  const r4 = totalsY + 20;

  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal', xL, r1);
  doc.text(subtotal.toFixed(2), xR, r1, { align: 'right' });
  doc.line(xL, r1 + 2, xR, r1 + 2);

  doc.text('Discount', xL, r2);
  doc.text(disc.toFixed(2), xR, r2, { align: 'right' });
  doc.line(xL, r2 + 2, xR, r2 + 2);

  doc.text('Tax', xL, r3);
  doc.text(tax.toFixed(2), xR, r3, { align: 'right' });
  doc.line(xL, r3 + 2, xR, r3 + 2);

  doc.setFont('helvetica', 'bold');
  doc.text('Grand Total', xL, r4);
  doc.text(total.toFixed(2), xR, r4, { align: 'right' });

  const signForY = doc.internal.pageSize.getHeight() - 24;
  doc.setFont('helvetica', 'normal');
  doc.text(`For ${String(company?.companyName || 'PharmaFlow Pro')}`, xR, signForY, { align: 'right' });
  doc.line(xR - 52, signForY + 10, xR, signForY + 10);
  doc.text('Authorized Signatory', xR, signForY + 16, { align: 'right' });

  return doc;
}

export function openInvoicePdfPreview(inv: any, ord: any, company: any, customers: any[]) {
  const doc = buildInvoicePdfDoc(inv, ord, company, customers);
  const url = doc.output('bloburl');
  window.open(url, '_blank');
}

export function downloadInvoicePdf(inv: any, ord: any, company: any, customers: any[]) {
  const doc = buildInvoicePdfDoc(inv, ord, company, customers);
  doc.save(`${inv.invoiceNo}.pdf`);
}
