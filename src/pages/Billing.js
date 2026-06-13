import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { addBill, getCustomers, getProducts, updateProduct, uploadInvoiceFile } from '../services/api';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/* ─────────────────────────────── helpers ──────────────────────────────── */
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free'];
const CATS  = ['Kurti','Saree','Leggings','Tops','Nighty','Chudithar','Other'];
const LS    = 'anyaa_billing_draft';

function genInv() {
  return `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function now() {
  return new Date().toLocaleString('en-IN', { 
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

/* Read / write draft to localStorage */
function loadDraft() {
  try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch { return null; }
}
function saveDraft(data) {
  try { localStorage.setItem(LS, JSON.stringify(data)); } catch {}
}
function clearDraft() {
  try { localStorage.removeItem(LS); } catch {}
}

/* ─────────────────────── Product Search Cell ───────────────────────────── */
function ProductSearchCell({ value, products, onSelect, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  const filtered = useMemo(() =>
    products.filter(p =>
      p.name.toLowerCase().includes(value.toLowerCase()) ||
      (p.sku || '').toLowerCase().includes(value.toLowerCase())
    ).slice(0, 8),
  [products, value]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        className="tbl-input"
        value={value}
        placeholder="Search product…"
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="prod-drop">
          {filtered.map(p => (
            <div
              key={p.id}
              className="prod-drop-item"
              onMouseDown={() => { onSelect(p); setOpen(false); }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span className="drop-name">{p.name}</span>
                {p.sku && <span style={{ fontSize: 10, color: '#b090a8', fontFamily: 'monospace' }}>SKU: {p.sku}</span>}
              </div>
              <span className="drop-meta">{p.category} · ₹{(p.price || 0).toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────── Invoice Preview ───────────────────────────── */
export function InvoiceView({ inv }) {
  const { invoiceId, date, customer, phone, lineItems = [], paymentMethod, grandTotal } = inv;
  const subtotal = (lineItems || []).reduce((s, r) => s + (Number(r.rate) || 0) * (Number(r.qty) || 0), 0);

  return (
    <div id="printable-invoice" style={{ fontFamily: "'Georgia', serif", color: '#1a1a1a', padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', borderBottom: '3px double #c07a9c', paddingBottom: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 3, color: '#8b3a6a', textTransform: 'uppercase' }}>
          🌸 Anyaa Textiles
        </div>
        <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
          Premium Fashion &amp; Ethnic Wear &nbsp;|&nbsp; Tailored for You
        </div>
        <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
          Contact: +91 98765 43210 &nbsp;|&nbsp; anyaatextiles@gmail.com
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#8b3a6a', marginBottom: 4 }}>INVOICE</div>
          <div><strong>No:</strong> {invoiceId}</div>
          <div><strong>Date:</strong> {date}</div>
          <div><strong>Payment:</strong> {paymentMethod}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#8b3a6a', marginBottom: 4 }}>BILL TO</div>
          <div style={{ fontWeight: 600 }}>{customer}</div>
          {phone && <div>📞 {phone}</div>}
        </div>
      </div>

      {/* Items */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 14 }}>
        <thead>
          <tr style={{ background: '#8b3a6a', color: '#fff' }}>
            {['#','Product','Category','Size','Qty','Rate (₹)','Total (₹)'].map((h, i) => (
              <th key={h} style={{ padding: '7px 10px', textAlign: i >= 4 ? 'right' : i === 2 || i === 3 ? 'center' : 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(lineItems || []).map((item, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fdf6fa' : '#fff', borderBottom: '1px solid #f0d8e8' }}>
              <td style={{ padding: '7px 10px' }}>{i + 1}</td>
              <td style={{ padding: '7px 10px', fontWeight: 600 }}>{item.name}</td>
              <td style={{ padding: '7px 10px', textAlign: 'center' }}>{item.category}</td>
              <td style={{ padding: '7px 10px', textAlign: 'center' }}>{item.size}</td>
              <td style={{ padding: '7px 10px', textAlign: 'right' }}>{item.qty}</td>
              <td style={{ padding: '7px 10px', textAlign: 'right' }}>{Number(item.rate).toLocaleString('en-IN')}</td>
              <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>
                {(item.qty * Number(item.rate)).toLocaleString('en-IN')}
              </td>
            </tr>
          ))}
          {(!lineItems || lineItems.length === 0) && (
            <tr><td colSpan={7} style={{ padding: '14px', textAlign: 'center', color: '#bbb' }}>No line items</td></tr>
          )}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
        <table style={{ fontSize: 12, minWidth: 220 }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px 10px', color: '#555' }}>Subtotal</td>
              <td style={{ padding: '4px 10px', textAlign: 'right' }}>₹{subtotal.toLocaleString('en-IN')}</td>
            </tr>
            <tr style={{ borderTop: '2px solid #8b3a6a' }}>
              <td style={{ padding: '8px 10px', fontWeight: 800, fontSize: 14, color: '#8b3a6a' }}>GRAND TOTAL</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontSize: 14, color: '#8b3a6a' }}>
                ₹{Number(grandTotal || subtotal).toLocaleString('en-IN')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', borderTop: '2px dashed #c07a9c', paddingTop: 10, fontSize: 11, color: '#888' }}>
        <div style={{ fontWeight: 700, color: '#8b3a6a', marginBottom: 3 }}>Thank you for shopping with us! 🌸</div>
        <div>Goods once sold will not be returned. Exchange within 3 days with bill.</div>
      </div>
    </div>
  );
}

/* ──────────────────────────── Main Billing ──────────────────────────────── */
export default function Billing() {
  // Initialise from persisted draft so state survives tab switches
  const draft = loadDraft() || {};

  const [invoiceId, setInvoiceId]     = useState(draft.invoiceId   || genInv());
  const [autoInv,   setAutoInv]       = useState(draft.autoInv     ?? true);
  const [customers, setCustomers]     = useState([]);
  const [products,  setProducts]      = useState([]);
  const [custMode,  setCustMode]      = useState(draft.custMode     || 'walkin');
  const [selCustId, setSelCustId]     = useState(draft.selCustId    || '');
  const [custName,  setCustName]      = useState(draft.custName     || 'Walk-in Customer');
  const [custPhone, setCustPhone]     = useState(draft.custPhone    || '');
  const [rows,      setRows]          = useState(draft.rows         || []);
  const [payment,   setPayment]       = useState(draft.payment      || 'Cash');
  const [showInvoice, setShowInvoice] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [sharing, setSharing]         = useState(null);

  useEffect(() => {
    getCustomers().then(r => setCustomers(r.data)).catch(() => {});
    getProducts().then(r => setProducts(r.data)).catch(() => {});
  }, []);

  /* auto-save draft to localStorage on every billing state change */
  useEffect(() => {
    saveDraft({ invoiceId, autoInv, custMode, selCustId, custName, custPhone, rows, payment });
  }, [invoiceId, autoInv, custMode, selCustId, custName, custPhone, rows, payment]);

  /* customer mode sync */
  useEffect(() => {
    if (custMode === 'walkin') { setCustName('Walk-in Customer'); setCustPhone(''); }
    else if (custMode === 'existing' && selCustId) {
      const c = customers.find(c => String(c.id) === String(selCustId));
      if (c) { setCustName(c.name); setCustPhone(c.phone || ''); }
    }
  }, [custMode, selCustId, customers]);

  /* ── row helpers ── */
  const addBlankRow = () => setRows(p => [...p, { _uid: Date.now(), name: '', category: '', size: 'M', rate: '', qty: 1 }]);

  const updateRow = useCallback((uid, field, val) => {
    setRows(p => p.map(r => r._uid === uid ? { ...r, [field]: val } : r));
  }, []);

  const selectProduct = useCallback((uid, prod) => {
    setRows(p => p.map(r => r._uid === uid
      ? { ...r, name: prod.name, category: prod.category || '', size: prod.size || 'M', rate: prod.price || '', _productId: prod.id }
      : r
    ));
  }, []);

  const removeRow = useCallback((uid) => setRows(p => p.filter(r => r._uid !== uid)), []);

  /* ── totals ── */
  const hasValidItem = rows.some(r => r.name && r.name.trim() !== '');
  
  const grandTotal = useMemo(() =>
    Math.round(rows.reduce((s, r) => s + (Number(r.rate) || 0) * (Number(r.qty) || 0), 0)),
  [rows]);

  const totalQty = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);

  /* ── build invoice object ── */
  const buildInvoice = () => ({
    invoiceId,
    date: now(),
    customer: custName || 'Walk-in Customer',
    phone: custPhone,
    lineItems: rows.map(({ _uid, ...rest }) => rest),
    paymentMethod: payment,
    grandTotal,
  });

  /* ── save to DB + deduct stock ── */
  const saveToDB = async (inv) => {
    try {
      await addBill({
        id: inv.invoiceId,
        customer: inv.customer,
        phone: inv.phone,
        amount: inv.grandTotal,
        items: totalQty,
        time: 'Just now',
        status: 'completed',
        payment: inv.paymentMethod,
        date: inv.date,
        lineItems: inv.lineItems,
      });

      // Deduct stock for each line item that has a known product
      const validRows = rows.filter(r => r._productId && r.name && Number(r.qty) > 0);
      const currentProducts = await getProducts();
      const prodMap = {};
      (currentProducts.data || []).forEach(p => { prodMap[p.id] = p; });

      await Promise.all(
        validRows.map(row => {
          const prod = prodMap[row._productId];
          if (!prod) return null;
          const newStock = Math.max(0, Number(prod.stock ?? prod.available ?? 0) - Number(row.qty));
          return updateProduct(prod.id, { ...prod, stock: newStock });
        }).filter(Boolean)
      );
    } catch (e) { console.error(e); }
  };

  /* ── handlers ── */
  const handleGenerate = () => { if (hasValidItem) setShowInvoice(true); };

  const handleWhatsApp = async () => {
    setSharing('pdf');
    try {
      const inv = buildInvoice();
      await saveToDB(inv);
      
      const file = await generateInvoiceFile('pdf');
      let fileUrl = '';
      if (file) {
        try {
          const uploadRes = await uploadInvoiceFile(file);
          if (uploadRes.data && uploadRes.data.link) {
            fileUrl = uploadRes.data.link.startsWith('http')
              ? uploadRes.data.link
              : `http://localhost:3001${uploadRes.data.link}`;
          }
        } catch (uploadErr) {
          console.error('Failed to upload PDF:', uploadErr);
        }
      }
      
      const lines = inv.lineItems.map(it =>
        `• ${it.name} (${it.category} | ${it.size}) x${it.qty} @ ₹${Number(it.rate).toLocaleString('en-IN')} = ₹${(it.qty * Number(it.rate)).toLocaleString('en-IN')}`
      ).join('\n');
      let msg = `🌸 *Anyaa Textiles* 🌸\nInvoice: *${inv.invoiceId}*\nDate: ${inv.date}\nCustomer: ${inv.customer}\n\n*Items:*\n${lines}\n\n*Total: ₹${inv.grandTotal.toLocaleString('en-IN')}*\nPayment: ${inv.paymentMethod}\n\nThank you for shopping! 💐`;
      
      if (fileUrl) {
        msg += `\n\nView the invoice: ${fileUrl}`;
      }

      const ph = custPhone.replace(/\D/g, '');
      window.open(ph ? `https://wa.me/91${ph}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      finalize();
    } catch (e) {
      console.error(e);
      alert('Failed to send invoice via WhatsApp.');
    }
    setSharing(null);
  };

  const handlePrint = async () => {
    await saveToDB(buildInvoice());
    window.print();
    finalize();
  };

  const generateInvoiceFile = async (format) => {
    const element = document.getElementById('printable-invoice');
    if (!element) return null;
    
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });
    
    if (format === 'image') {
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(new File([blob], `invoice-${invoiceId}.png`, { type: 'image/png' }));
        }, 'image/png');
      });
    } else if (format === 'pdf') {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      const pdfBlob = pdf.output('blob');
      return new File([pdfBlob], `invoice-${invoiceId}.pdf`, { type: 'application/pdf' });
    }
  };

  const handleShareFile = async (format) => {
    setSharing(format);
    try {
      const inv = buildInvoice();
      await saveToDB(inv);
      
      const file = await generateInvoiceFile(format);
      if (!file) {
        setSharing(null);
        return;
      }

      // Upload file to local server
      let fileUrl = '';
      try {
        const uploadRes = await uploadInvoiceFile(file);
        if (uploadRes.data && uploadRes.data.link) {
          fileUrl = uploadRes.data.link.startsWith('http')
            ? uploadRes.data.link
            : `http://localhost:3001${uploadRes.data.link}`;
        }
      } catch (uploadErr) {
        console.error('Failed to upload file to server:', uploadErr);
      }
      
      const lines = inv.lineItems.map(it =>
        `• ${it.name} (${it.category} | ${it.size}) x${it.qty} @ ₹${Number(it.rate).toLocaleString('en-IN')} = ₹${(it.qty * Number(it.rate)).toLocaleString('en-IN')}`
      ).join('\n');
      let msg = `🌸 *Anyaa Textiles* 🌸\nInvoice: *${inv.invoiceId}*\nDate: ${inv.date}\nCustomer: ${inv.customer}\n\n*Items:*\n${lines}\n\n*Total: ₹${inv.grandTotal.toLocaleString('en-IN')}*\nPayment: ${inv.paymentMethod}\n\nThank you for shopping! 💐`;
      
      if (fileUrl) {
        msg += `\n\nView the invoice: ${fileUrl}`;
      }

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Invoice ${inv.invoiceId}`,
          text: msg
        });
        finalize();
      } else {
        // Fallback: download
        const link = document.createElement('a');
        link.href = URL.createObjectURL(file);
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Copy summary to clipboard
        try {
          await navigator.clipboard.writeText(msg);
        } catch (err) {
          console.error(err);
        }
        
        // Open WhatsApp
        const ph = custPhone.replace(/\D/g, '');
        window.open(ph ? `https://wa.me/91${ph}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        
        alert(`Invoice ${format.toUpperCase()} downloaded successfully and stored on server!\n\nWe have copied the invoice summary with the server link to your clipboard and opened WhatsApp. You can paste the text and attach the downloaded file there.`);
        finalize();
      }
    } catch (err) {
      console.error(err);
      alert(`Failed to share invoice as ${format.toUpperCase()}.`);
    }
    setSharing(null);
  };

  const finalize = () => {
    clearDraft(); // wipe persisted draft
    setShowInvoice(false);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setRows([]);
      setCustMode('walkin');
      setCustPhone('');
      setInvoiceId(genInv());
    }, 2000);
  };

  /* ─────────────────────────────── JSX ───────────────────────────────────── */
  return (
    <>
      <style>{`
        /* ── Page ── */
        .billing-wrap {
          display: flex; flex-direction: column; gap: 0;
          height: calc(100vh - 88px);
        }

        /* ── Top card ── */
        .bill-card {
          background: #fff; border-radius: 18px;
          border: 1px solid #f0e0ec; box-shadow: 0 2px 16px rgba(139,58,106,.07);
          display: flex; flex-direction: column; overflow: hidden; flex: 1;
        }

        /* ── Invoice header bar ── */
        .bill-header {
          padding: 16px 24px 14px; border-bottom: 1px solid #f5edf3;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
        }
        .bill-title { font-size: 16px; font-weight: 800; color: #4a1942; margin: 0; }
        .inv-id-area { display: flex; align-items: center; gap: 8px; }
        .inv-badge {
          background: #fdf0f8; border: 1px solid #e8b4d4; color: #8b3a6a;
          font-size: 11px; font-weight: 700; padding: 5px 14px; border-radius: 20px;
          font-family: monospace; letter-spacing: .5px;
        }
        .inv-edit-inp {
          border: 1px solid #c07a9c; border-radius: 8px; padding: 5px 10px;
          font-size: 11px; font-family: monospace; width: 145px; outline: none;
          background: #fdf6fa; color: #4a1942;
        }
        .icon-btn {
          background: none; border: none; cursor: pointer; font-size: 15px; padding: 2px 4px;
          transition: .15s; border-radius: 6px;
        }
        .icon-btn:hover { background: #f5edf3; }

        /* ── Customer section ── */
        .cust-section {
          padding: 14px 24px; border-bottom: 1px solid #f5edf3;
          display: flex; flex-direction: column; gap: 10px;
        }
        .cust-tabs { display: flex; gap: 6px; }
        .cust-tab {
          padding: 5px 14px; border-radius: 20px; font-size: 11px; font-weight: 700;
          border: 1px solid #e8d4e4; cursor: pointer; background: #fff; color: #8b3a6a;
          transition: .15s;
        }
        .cust-tab.active { background: #8b3a6a; color: #fff; border-color: #8b3a6a; }
        .cust-fields { display: flex; gap: 10px; align-items: center; }
        .cust-inp, .cust-sel {
          flex: 1; border: 1px solid #e8d4e4; border-radius: 10px;
          padding: 8px 12px; font-size: 12px; outline: none; background: #fdf6fa; color: #333;
          font-family: inherit;
        }
        .cust-inp:focus, .cust-sel:focus { border-color: #c07a9c; background: #fff; }
        .wa-badge {
          display: inline-flex; align-items: center; gap: 5px;
          background: #e8f9ef; border: 1px solid #a8d8b4; color: #1a7a3a;
          font-size: 11px; font-weight: 700; padding: 5px 12px; border-radius: 20px;
          text-decoration: none; white-space: nowrap;
        }

        /* ── Items table ── */
        .items-wrap { flex: 1; overflow-y: auto; padding: 12px 24px; }
        .bill-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .bill-table thead tr { background: #f7eef5; }
        .bill-table th {
          padding: 9px 8px; text-align: left; font-size: 10px; font-weight: 700;
          color: #8b3a6a; text-transform: uppercase; letter-spacing: .5px;
          border-bottom: 2px solid #e8d4e4;
        }
        .bill-table td { padding: 5px 4px; border-bottom: 1px solid #f8f0f6; vertical-align: middle; }
        .bill-table .row-num { font-size: 11px; color: #bbb; text-align: center; width: 28px; }
        .bill-table .row-total { font-weight: 700; color: #4a1942; text-align: right; font-size: 13px; }
        .tbl-input, .tbl-select {
          width: 100%; border: 1px solid #eedce8; border-radius: 7px;
          padding: 5px 8px; font-size: 12px; outline: none; background: #fdf6fa;
          color: #333; font-family: inherit; transition: .12s;
        }
        .tbl-input:focus, .tbl-select:focus { border-color: #c07a9c; background: #fff; }
        .tbl-input[type=number] { text-align: right; }
        .rm-btn {
          width: 24px; height: 24px; border-radius: 50%; background: #ffe4ef;
          border: none; color: #c04070; cursor: pointer; font-size: 15px; line-height: 1;
          display: flex; align-items: center; justify-content: center; transition: .15s;
          flex-shrink: 0;
        }
        .rm-btn:hover { background: #ffb8d0; }

        /* Product search dropdown */
        .prod-drop {
          position: absolute; top: calc(100% + 3px); left: 0; right: 0;
          background: #fff; border: 1px solid #e0cce0; border-radius: 10px;
          box-shadow: 0 6px 24px rgba(139,58,106,.18); z-index: 200;
          max-height: 220px; overflow-y: auto;
        }
        .prod-drop-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 12px; cursor: pointer; transition: .12s; gap: 8px;
        }
        .prod-drop-item:hover { background: #fdf0f8; }
        .drop-name { font-size: 12px; font-weight: 600; color: #3a1a34; }
        .drop-meta { font-size: 10px; color: #a07090; white-space: nowrap; }
        .add-row-btn {
          margin-top: 10px; padding: 7px 18px; border: 1.5px dashed #c07a9c;
          border-radius: 10px; background: #fff; color: #8b3a6a; font-size: 12px;
          font-weight: 600; cursor: pointer; transition: .15s;
        }
        .add-row-btn:hover { background: #fdf0f8; }

        /* ── Bottom bar ── */
        .bill-bottom {
          padding: 14px 24px; border-top: 1.5px solid #f0e0ec;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          flex-wrap: wrap;
        }
        .total-area { display: flex; flex-direction: column; }
        .total-label { font-size: 11px; color: #aaa; margin-bottom: 2px; }
        .grand-total { font-size: 26px; font-weight: 800; color: #8b3a6a; line-height: 1; }
        .total-meta { font-size: 11px; color: #bbb; margin-top: 2px; }
        .payment-group { display: flex; gap: 6px; }
        .pay-tab {
          padding: 8px 16px; border-radius: 10px; border: 1px solid #e8d4e4;
          font-size: 12px; font-weight: 700; cursor: pointer; background: #fff; color: #666;
          transition: .15s;
        }
        .pay-tab.active { background: #8b3a6a; color: #fff; border-color: #8b3a6a; }
        .action-group { display: flex; gap: 8px; }
        .btn-clear {
          padding: 11px 18px; border-radius: 12px; border: 1px solid #e8d4e4;
          background: #fff; color: #999; font-size: 12px; font-weight: 600; cursor: pointer;
          transition: .15s;
        }
        .btn-clear:hover { background: #fdf0f8; color: #c04070; border-color: #e8a4c4; }
        .btn-generate {
          padding: 11px 26px; border-radius: 12px;
          background: linear-gradient(135deg, #8b3a6a, #c07a9c);
          color: #fff; font-size: 13px; font-weight: 700; border: none; cursor: pointer;
          box-shadow: 0 4px 14px rgba(139,58,106,.3); transition: .15s; letter-spacing: .3px;
        }
        .btn-generate:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(139,58,106,.4); }
        .btn-generate:disabled { opacity: .45; cursor: not-allowed; }

        /* ── Invoice overlay ── */
        .inv-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.55);
          backdrop-filter: blur(4px); z-index: 9999;
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .inv-sheet {
          background: #fff; border-radius: 18px; width: 700px; max-height: 92vh;
          overflow-y: auto; box-shadow: 0 24px 70px rgba(0,0,0,.3);
          animation: slideUp .25s ease;
        }
        @keyframes slideUp { from{transform:translateY(28px);opacity:0} to{transform:translateY(0);opacity:1} }
        .inv-actions {
          display: flex; gap: 10px; padding: 14px 20px;
          border-bottom: 1px solid #f0e0ec; justify-content: flex-end; flex-wrap: wrap;
        }
        .inv-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 9px 18px; border-radius: 10px; font-size: 12px; font-weight: 700;
          cursor: pointer; border: none; transition: .15s;
        }
        .btn-wa   { background: #25d366; color: #fff; }
        .btn-wa:hover { background: #1aad54; }
        .btn-print { background: #4a90e2; color: #fff; }
        .btn-print:hover { background: #3178c6; }
        .btn-pdf { background: #e05252; color: #fff; }
        .btn-pdf:hover { background: #c53c3c; }
        .btn-img { background: #8b3a6a; color: #fff; }
        .btn-img:hover { background: #712c54; }
        .inv-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-x { background: #f5f5f5; color: #555; }
        .btn-x:hover { background: #ffe0e0; color: #c04040; }

        /* ── Print ── */
        @media print {
          body * { visibility: hidden !important; }
          #printable-invoice, #printable-invoice * { visibility: visible !important; }
          #printable-invoice { position: fixed; inset: 0; padding: 24px; }
          .no-print { display: none !important; }
        }

        /* ── Success toast ── */
        .toast {
          position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
          background: #fff; border: 1px solid #b4e4c4; border-radius: 16px;
          padding: 13px 28px; box-shadow: 0 8px 32px rgba(0,0,0,.14);
          z-index: 9999; display: flex; align-items: center; gap: 10px;
          font-size: 13px; font-weight: 600; color: #1a7a3a;
          animation: slideUp .3s ease;
        }
      `}</style>

      <div className="billing-wrap">
        <div className="bill-card">

          {/* ── Invoice ID bar ── */}
          <div className="bill-header">
            <h2 className="bill-title">🧾 New Invoice</h2>
            <div className="inv-id-area">
              {autoInv ? (
                <>
                  <span className="inv-badge">{invoiceId}</span>
                  <button className="icon-btn" title="Enter manually" onClick={() => setAutoInv(false)}>✏️</button>
                </>
              ) : (
                <>
                  <input className="inv-edit-inp" value={invoiceId} onChange={e => setInvoiceId(e.target.value)} />
                  <button className="icon-btn" title="Auto-generate" onClick={() => { setAutoInv(true); setInvoiceId(genInv()); }}>🔄</button>
                </>
              )}
            </div>
          </div>

          {/* ── Customer ── */}
          <div className="cust-section">
            <div className="cust-tabs">
              {[['walkin','Walk-in'],['existing','Existing'],['new','New']].map(([k,l]) => (
                <button key={k} className={`cust-tab ${custMode === k ? 'active' : ''}`} onClick={() => setCustMode(k)}>{l}</button>
              ))}
            </div>

            {custMode === 'walkin' && (
              <div className="cust-fields">
                <input className="cust-inp" value="Walk-in Customer" readOnly style={{ color: '#aaa' }} />
              </div>
            )}

            {custMode === 'existing' && (
              <div className="cust-fields">
                <select className="cust-sel" value={selCustId} onChange={e => setSelCustId(e.target.value)}>
                  <option value="">— Select Customer —</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
                {custPhone && (
                  <a className="wa-badge" href={`https://wa.me/91${custPhone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer">
                    📱 {custPhone}
                  </a>
                )}
              </div>
            )}

            {custMode === 'new' && (
              <div className="cust-fields">
                <input
                  className="cust-inp"
                  placeholder="Customer Name"
                  value={custName === 'Walk-in Customer' ? '' : custName}
                  onChange={e => setCustName(e.target.value)}
                />
                <input
                  className="cust-inp"
                  placeholder="Phone (WhatsApp)"
                  value={custPhone}
                  onChange={e => setCustPhone(e.target.value)}
                  maxLength={10}
                />
                {custPhone.length >= 10 && (
                  <a className="wa-badge" href={`https://wa.me/91${custPhone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer">
                    💬 WA
                  </a>
                )}
              </div>
            )}
          </div>

          {/* ── Items ── */}
          <div className="items-wrap">
            <table className="bill-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}>#</th>
                  <th>Product Name</th>
                  <th style={{ width: 110 }}>Category</th>
                  <th style={{ width: 80 }}>Size</th>
                  <th style={{ width: 60 }}>Qty</th>
                  <th style={{ width: 100 }}>Rate (₹)</th>
                  <th style={{ width: 90, textAlign: 'right' }}>Total</th>
                  <th style={{ width: 28 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '36px 0', color: '#ccc', fontSize: 13 }}>
                      Click "+ Add Row" to start billing
                    </td>
                  </tr>
                ) : rows.map((row, i) => (
                  <tr key={row._uid}>
                    <td className="row-num">{i + 1}</td>
                    <td>
                      <ProductSearchCell
                        value={row.name}
                        products={products}
                        onChange={val => updateRow(row._uid, 'name', val)}
                        onSelect={prod => selectProduct(row._uid, prod)}
                      />
                    </td>
                    <td>
                      <select className="tbl-select" value={row.category} onChange={e => updateRow(row._uid, 'category', e.target.value)}>
                        <option value="">—</option>
                        {CATS.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="tbl-select" value={row.size} onChange={e => updateRow(row._uid, 'size', e.target.value)}>
                        {SIZES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number" min="1" className="tbl-input"
                        value={row.qty}
                        onChange={e => updateRow(row._uid, 'qty', Math.max(1, Number(e.target.value)))}
                        style={{ textAlign: 'center' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number" min="0" className="tbl-input"
                        value={row.rate}
                        onChange={e => updateRow(row._uid, 'rate', e.target.value)}
                      />
                    </td>
                    <td className="row-total">
                      ₹{((Number(row.rate) || 0) * (Number(row.qty) || 0)).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <button className="rm-btn" onClick={() => removeRow(row._uid)}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="add-row-btn" onClick={addBlankRow}>＋ Add Row</button>
          </div>

          {/* ── Bottom bar ── */}
          <div className="bill-bottom">
            <div className="total-area">
              <div className="total-label">Grand Total</div>
              <div className="grand-total">₹{grandTotal.toLocaleString('en-IN')}</div>
              <div className="total-meta">{totalQty} item{totalQty !== 1 ? 's' : ''}</div>
            </div>
            <div className="payment-group">
              {[['💵','Cash'],['📱','UPI'],['💳','Card']].map(([ic,m]) => (
                <button key={m} className={`pay-tab ${payment === m ? 'active' : ''}`} onClick={() => setPayment(m)}>{ic} {m}</button>
              ))}
            </div>
            <div className="action-group">
              <button className="btn-clear" onClick={() => setRows([])}>Clear</button>
              <button className="btn-generate" onClick={handleGenerate} disabled={!hasValidItem}>
                🧾 Generate Invoice
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Invoice Preview Modal ── */}
      {showInvoice && (
        <div className="inv-overlay" onClick={() => setShowInvoice(false)}>
          <div className="inv-sheet" onClick={e => e.stopPropagation()}>
            <div className="inv-actions no-print">
              <button className="inv-btn btn-wa" onClick={handleWhatsApp} disabled={!!sharing}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.533 5.849L.057 23.716a.5.5 0 00.612.612l5.867-1.476A11.942 11.942 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.943 0-3.763-.524-5.33-1.438l-.382-.228-3.483.877.893-3.483-.228-.382A9.952 9.952 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
                {sharing === 'pdf' ? 'Uploading PDF...' : 'WhatsApp'}
              </button>
              <button className="inv-btn btn-pdf" onClick={() => handleShareFile('pdf')} disabled={!!sharing}>
                📁 {sharing === 'pdf' ? 'Generating PDF...' : 'Share PDF'}
              </button>
              <button className="inv-btn btn-img" onClick={() => handleShareFile('image')} disabled={!!sharing}>
                🖼️ {sharing === 'image' ? 'Generating Image...' : 'Share Image'}
              </button>
              <button className="inv-btn btn-print" onClick={handlePrint} disabled={!!sharing}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                Print Invoice
              </button>
              <button className="inv-btn btn-x" onClick={() => setShowInvoice(false)} disabled={!!sharing}>✕ Close</button>
            </div>
            <InvoiceView inv={buildInvoice()} />
          </div>
        </div>
      )}

      {showSuccess && (
        <div className="toast">✅ Invoice saved successfully!</div>
      )}
    </>
  );
}
