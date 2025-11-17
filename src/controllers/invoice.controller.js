import Invoice from "../models/invoice.model.js";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import Settings from "../models/settings.model.js";
import puppeteer from "puppeteer";
import QRCode from "qrcode";
import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate invoice PDF
export const generateInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { template = "default", email = false, preview = false } = req.query;
    const adminId = req.user.id;
    const adminName = req.user.name;

    // Get order details
    const order = await Order.findById(orderId)
      .populate("customerId", "name email phone")
      .populate("items.productId", "title sku hsn")
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Get company settings
    const settings = await Settings.getSettings();

    // Check if invoice already exists
    let invoice = await Invoice.findOne({ orderId });

    if (!invoice) {
      // Create new invoice
      invoice = new Invoice({
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerId: order.customerId?._id,
        billingAddress: order.billingAddress || order.shippingAddress,
        shippingAddress: order.shippingAddress,
        items: order.items.map((item) => ({
          productId: item.productId._id,
          name: item.title,
          sku: item.sku,
          hsn: item.hsn,
          quantity: item.quantity,
          unitPrice: item.price,
          discount: item.discount || 0,
          lineTotal: item.total,
        })),
        subtotal: order.subtotal,
        totalDiscount: order.discountAmount,
        shippingCost: order.shippingCost,
        totalTax: order.taxAmount,
        adjustments: order.adjustments || 0,
        grandTotal: order.totalAmount,
        currency: order.currency,
        paymentMethod: order.payment?.method || order.paymentMethod,
        paymentStatus: order.payment?.status || order.paymentStatus,
        coupon: order.coupon?.code
          ? {
              code: order.coupon.code,
              discount: order.coupon.discount,
            }
          : undefined,
        company: {
          name: settings.company.name,
          logo: settings.company.logo?.url,
          address: settings.company.address,
          phone: settings.company.phone,
          email: settings.company.email,
          website: settings.company.website,
          gstin: settings.company.gstin,
          pan: settings.company.pan,
        },
        template,
        termsAndConditions: settings.invoice.termsAndConditions,
        notes: settings.invoice.defaultNotes,
        createdBy: adminId,
        createdByName: adminName,
      });

      await invoice.save();
    }

    // Generate PDF if not in preview mode
    let pdfPath = null;
    if (!preview) {
      pdfPath = await generateInvoicePDF(invoice, settings, template);

      // Update invoice with PDF info
      invoice.pdfGenerated = true;
      invoice.pdfPath = pdfPath;
      await invoice.save();

      // Update order
      await Order.findByIdAndUpdate(orderId, {
        invoiceGenerated: true,
        invoiceNumber: invoice.invoiceNumber,
        invoiceGeneratedAt: new Date(),
      });
    }

    // Send email if requested
    if (email && !preview && order.customerId?.email) {
      try {
        await emailInvoice(invoice, order.customerId.email, settings, pdfPath);
        invoice.markEmailSent(order.customerId.email);
        await invoice.save();
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
      }
    }

    if (preview) {
      // Return HTML preview
      const html = await generateInvoiceHTML(invoice, settings, template);
      res.send(html);
    } else {
      // Return PDF download
      if (fs.existsSync(pdfPath)) {
        res.download(pdfPath, `invoice-${invoice.invoiceNumber}.pdf`, (err) => {
          if (err) {
            console.error("PDF download error:", err);
            res.status(500).json({
              success: false,
              message: "Failed to download PDF",
            });
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: "PDF generation failed",
        });
      }
    }
  } catch (error) {
    console.error("Generate invoice error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate invoice",
      error: error.message,
    });
  }
};

// Email invoice to customer
export const emailInvoice = async (
  invoice,
  recipientEmail,
  settings,
  pdfPath
) => {
  try {
    // Configure email transporter (in production, use environment variables)
    const transporter = nodemailer.createTransporter({
      host: settings.email.smtp.host || "smtp.gmail.com",
      port: settings.email.smtp.port || 587,
      secure: false,
      auth: {
        user: settings.email.smtp.username || process.env.EMAIL_USERNAME,
        pass: settings.email.smtp.password || process.env.EMAIL_PASSWORD,
      },
    });

    const emailTemplate = settings.getEmailTemplate("invoice") || {
      subject: "Invoice #{invoiceNumber} from {companyName}",
      body: `
        <h2>Invoice #{invoiceNumber}</h2>
        <p>Dear Customer,</p>
        <p>Please find attached your invoice for order #{orderNumber}.</p>
        <p>Thank you for your business!</p>
        <br>
        <p>Best regards,<br>{companyName}</p>
      `,
    };

    // Replace template variables
    const subject = emailTemplate.subject
      .replace("{invoiceNumber}", invoice.invoiceNumber)
      .replace("{companyName}", settings.company.name);

    const body = emailTemplate.body
      .replace("{invoiceNumber}", invoice.invoiceNumber)
      .replace("{orderNumber}", invoice.orderNumber)
      .replace("{companyName}", settings.company.name);

    const mailOptions = {
      from: `${settings.email.from?.name || settings.company.name} <${
        settings.email.from?.email || settings.company.email
      }>`,
      to: recipientEmail,
      subject,
      html: body,
      attachments: pdfPath
        ? [
            {
              filename: `invoice-${invoice.invoiceNumber}.pdf`,
              path: pdfPath,
            },
          ]
        : [],
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Email invoice error:", error);
    throw error;
  }
};

// Generate invoice HTML
export const generateInvoiceHTML = async (
  invoice,
  settings,
  template = "default"
) => {
  try {
    // Generate QR code if enabled
    let qrCodeData = null;
    if (settings.invoice.qrCode.enabled) {
      const qrData = `${
        settings.company.website || "https://urbanhub.com"
      }/invoice/${invoice.invoiceNumber}`;
      qrCodeData = await QRCode.toDataURL(qrData, {
        width: settings.invoice.qrCode.size || 150,
        margin: 2,
      });
    }

    // Format currency
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat(
        settings.localization.defaultLocale || "en-IN",
        {
          style: "currency",
          currency: invoice.currency,
        }
      ).format(amount);
    };

    // Format date
    const formatDate = (date) => {
      return new Intl.DateTimeFormat(
        settings.localization.defaultLocale || "en-IN"
      ).format(new Date(date));
    };

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${invoice.invoiceNumber}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Arial', sans-serif;
          line-height: 1.6;
          color: #333;
          background: white;
        }
        
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background: white;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 2px solid #f0f0f0;
        }
        
        .company-info {
          flex: 1;
        }
        
        .company-logo {
          max-width: 150px;
          max-height: 80px;
          margin-bottom: 10px;
        }
        
        .company-name {
          font-size: 28px;
          font-weight: bold;
          color: #2c3e50;
          margin-bottom: 5px;
        }
        
        .company-address {
          font-size: 12px;
          color: #666;
          line-height: 1.4;
        }
        
        .invoice-meta {
          text-align: right;
          flex: 1;
        }
        
        .invoice-title {
          font-size: 32px;
          font-weight: bold;
          color: #e74c3c;
          margin-bottom: 10px;
        }
        
        .invoice-number {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .invoice-date {
          color: #666;
          font-size: 14px;
        }
        
        .addresses {
          display: flex;
          justify-content: space-between;
          margin-bottom: 40px;
          gap: 40px;
        }
        
        .address-block {
          flex: 1;
        }
        
        .address-title {
          font-size: 14px;
          font-weight: bold;
          color: #2c3e50;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        
        .address-content {
          font-size: 13px;
          line-height: 1.5;
          color: #555;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        
        .items-table th {
          background: #f8f9fa;
          padding: 12px 8px;
          text-align: left;
          font-weight: bold;
          font-size: 12px;
          text-transform: uppercase;
          border-bottom: 2px solid #dee2e6;
          color: #2c3e50;
        }
        
        .items-table td {
          padding: 10px 8px;
          border-bottom: 1px solid #dee2e6;
          font-size: 13px;
        }
        
        .items-table .text-right {
          text-align: right;
        }
        
        .items-table .text-center {
          text-align: center;
        }
        
        .totals {
          float: right;
          width: 300px;
          margin-bottom: 30px;
        }
        
        .totals-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .totals-table td {
          padding: 8px 12px;
          border-bottom: 1px solid #dee2e6;
          font-size: 13px;
        }
        
        .totals-table .label {
          text-align: left;
          font-weight: normal;
          color: #666;
        }
        
        .totals-table .amount {
          text-align: right;
          font-weight: bold;
        }
        
        .totals-table .final-total {
          background: #f8f9fa;
          font-size: 16px;
          font-weight: bold;
          color: #2c3e50;
          border-top: 2px solid #dee2e6;
          border-bottom: 2px solid #dee2e6;
        }
        
        .payment-info {
          margin-bottom: 30px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 5px;
        }
        
        .payment-info h4 {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 8px;
          color: #2c3e50;
        }
        
        .payment-info p {
          font-size: 13px;
          margin-bottom: 5px;
          color: #555;
        }
        
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #dee2e6;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        
        .footer-content {
          flex: 1;
        }
        
        .terms {
          font-size: 11px;
          color: #666;
          line-height: 1.4;
          margin-bottom: 10px;
        }
        
        .notes {
          font-size: 12px;
          color: #555;
          font-style: italic;
        }
        
        .qr-code {
          text-align: center;
          margin-left: 20px;
        }
        
        .qr-code img {
          max-width: 100px;
          max-height: 100px;
        }
        
        .signature {
          text-align: right;
          margin-top: 40px;
        }
        
        .signature-line {
          border-top: 1px solid #666;
          width: 200px;
          margin: 20px 0 5px auto;
        }
        
        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
        }
        
        .status-paid {
          background: #d4edda;
          color: #155724;
        }
        
        .status-pending {
          background: #fff3cd;
          color: #856404;
        }
        
        .status-failed {
          background: #f8d7da;
          color: #721c24;
        }
        
        @media print {
          .invoice-container {
            padding: 0;
            box-shadow: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header -->
        <div class="header">
          <div class="company-info">
            ${
              invoice.company.logo
                ? `<img src="${invoice.company.logo}" alt="${invoice.company.name}" class="company-logo">`
                : ""
            }
            <div class="company-name">${invoice.company.name}</div>
            <div class="company-address">
              ${invoice.company.address.addressLine1}<br>
              ${
                invoice.company.address.addressLine2
                  ? invoice.company.address.addressLine2 + "<br>"
                  : ""
              }
              ${invoice.company.address.city}, ${
      invoice.company.address.state
    } ${invoice.company.address.postalCode}<br>
              ${invoice.company.address.country}<br>
              ${
                invoice.company.phone
                  ? "Phone: " + invoice.company.phone + "<br>"
                  : ""
              }
              ${
                invoice.company.email
                  ? "Email: " + invoice.company.email + "<br>"
                  : ""
              }
              ${invoice.company.gstin ? "GSTIN: " + invoice.company.gstin : ""}
            </div>
          </div>
          
          <div class="invoice-meta">
            <div class="invoice-title">INVOICE</div>
            <div class="invoice-number">${invoice.invoiceNumber}</div>
            <div class="invoice-date">Date: ${formatDate(
              invoice.invoiceDate
            )}</div>
            ${
              invoice.dueDate
                ? `<div class="invoice-date">Due: ${formatDate(
                    invoice.dueDate
                  )}</div>`
                : ""
            }
            <div style="margin-top: 10px;">
              <span class="status-badge status-${
                invoice.paymentStatus
              }">${invoice.paymentStatus.toUpperCase()}</span>
            </div>
          </div>
        </div>
        
        <!-- Addresses -->
        <div class="addresses">
          <div class="address-block">
            <div class="address-title">Bill To</div>
            <div class="address-content">
              ${invoice.billingAddress.name}<br>
              ${
                invoice.billingAddress.company
                  ? invoice.billingAddress.company + "<br>"
                  : ""
              }
              ${invoice.billingAddress.addressLine1}<br>
              ${
                invoice.billingAddress.addressLine2
                  ? invoice.billingAddress.addressLine2 + "<br>"
                  : ""
              }
              ${invoice.billingAddress.city}, ${invoice.billingAddress.state} ${
      invoice.billingAddress.postalCode
    }<br>
              ${invoice.billingAddress.country}<br>
              ${
                invoice.billingAddress.phone
                  ? "Phone: " + invoice.billingAddress.phone + "<br>"
                  : ""
              }
              ${
                invoice.billingAddress.email
                  ? "Email: " + invoice.billingAddress.email
                  : ""
              }
            </div>
          </div>
          
          <div class="address-block">
            <div class="address-title">Ship To</div>
            <div class="address-content">
              ${
                invoice.shippingAddress.fullName || invoice.shippingAddress.name
              }<br>
              ${invoice.shippingAddress.addressLine1}<br>
              ${
                invoice.shippingAddress.addressLine2
                  ? invoice.shippingAddress.addressLine2 + "<br>"
                  : ""
              }
              ${invoice.shippingAddress.city}, ${
      invoice.shippingAddress.state
    } ${invoice.shippingAddress.postalCode}<br>
              ${invoice.shippingAddress.country}<br>
              ${
                invoice.shippingAddress.phone
                  ? "Phone: " + invoice.shippingAddress.phone + "<br>"
                  : ""
              }
              ${
                invoice.shippingAddress.email
                  ? "Email: " + invoice.shippingAddress.email
                  : ""
              }
            </div>
          </div>
        </div>
        
        <!-- Items Table -->
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 50%">Description</th>
              <th style="width: 10%" class="text-center">Qty</th>
              <th style="width: 15%" class="text-right">Unit Price</th>
              ${
                invoice.items.some((item) => item.discount > 0)
                  ? '<th style="width: 10%" class="text-right">Discount</th>'
                  : ""
              }
              <th style="width: 15%" class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items
              .map(
                (item) => `
              <tr>
                <td>
                  <strong>${item.name}</strong><br>
                  ${item.sku ? `<small>SKU: ${item.sku}</small><br>` : ""}
                  ${item.hsn ? `<small>HSN: ${item.hsn}</small>` : ""}
                </td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-right">${formatCurrency(item.unitPrice)}</td>
                ${
                  invoice.items.some((i) => i.discount > 0)
                    ? `<td class="text-right">${
                        item.discount > 0 ? formatCurrency(item.discount) : "-"
                      }</td>`
                    : ""
                }
                <td class="text-right">${formatCurrency(item.lineTotal)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        
        <!-- Totals -->
        <div class="totals">
          <table class="totals-table">
            <tr>
              <td class="label">Subtotal:</td>
              <td class="amount">${formatCurrency(invoice.subtotal)}</td>
            </tr>
            ${
              invoice.totalDiscount > 0
                ? `
              <tr>
                <td class="label">Discount:</td>
                <td class="amount">-${formatCurrency(
                  invoice.totalDiscount
                )}</td>
              </tr>
            `
                : ""
            }
            ${
              invoice.coupon && invoice.coupon.discount > 0
                ? `
              <tr>
                <td class="label">Coupon (${invoice.coupon.code}):</td>
                <td class="amount">-${formatCurrency(
                  invoice.coupon.discount
                )}</td>
              </tr>
            `
                : ""
            }
            ${
              invoice.shippingCost > 0
                ? `
              <tr>
                <td class="label">Shipping:</td>
                <td class="amount">${formatCurrency(invoice.shippingCost)}</td>
              </tr>
            `
                : ""
            }
            ${
              invoice.totalTax > 0
                ? `
              <tr>
                <td class="label">Tax:</td>
                <td class="amount">${formatCurrency(invoice.totalTax)}</td>
              </tr>
            `
                : ""
            }
            ${
              invoice.adjustments !== 0
                ? `
              <tr>
                <td class="label">Adjustments:</td>
                <td class="amount">${
                  invoice.adjustments > 0 ? "+" : ""
                }${formatCurrency(invoice.adjustments)}</td>
              </tr>
            `
                : ""
            }
            <tr class="final-total">
              <td class="label">Total:</td>
              <td class="amount">${formatCurrency(invoice.grandTotal)}</td>
            </tr>
          </table>
        </div>
        
        <div style="clear: both;"></div>
        
        <!-- Payment Info -->
        <div class="payment-info">
          <h4>Payment Information</h4>
          <p><strong>Payment Method:</strong> ${
            invoice.paymentMethod ? invoice.paymentMethod.toUpperCase() : "N/A"
          }</p>
          <p><strong>Payment Status:</strong> <span class="status-badge status-${
            invoice.paymentStatus
          }">${invoice.paymentStatus.toUpperCase()}</span></p>
          ${
            invoice.paymentTerms
              ? `<p><strong>Payment Terms:</strong> ${invoice.paymentTerms}</p>`
              : ""
          }
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <div class="footer-content">
            ${
              invoice.termsAndConditions
                ? `
              <div class="terms">
                <strong>Terms & Conditions:</strong><br>
                ${invoice.termsAndConditions.replace(/\n/g, "<br>")}
              </div>
            `
                : ""
            }
            
            ${
              invoice.notes
                ? `
              <div class="notes">
                ${invoice.notes}
              </div>
            `
                : ""
            }
            
            ${
              settings.invoice.footer.showSignature
                ? `
              <div class="signature">
                ${
                  settings.invoice.footer.signature?.name
                    ? `<div>${settings.invoice.footer.signature.name}</div>`
                    : ""
                }
                ${
                  settings.invoice.footer.signature?.title
                    ? `<div>${settings.invoice.footer.signature.title}</div>`
                    : ""
                }
                <div class="signature-line"></div>
                <div style="font-size: 11px; color: #666;">Authorized Signature</div>
              </div>
            `
                : ""
            }
          </div>
          
          ${
            qrCodeData
              ? `
            <div class="qr-code">
              <img src="${qrCodeData}" alt="QR Code">
              <div style="font-size: 10px; color: #666; margin-top: 5px;">Scan for details</div>
            </div>
          `
              : ""
          }
        </div>
      </div>
    </body>
    </html>
    `;

    return html;
  } catch (error) {
    console.error("Generate invoice HTML error:", error);
    throw error;
  }
};

// Generate PDF from HTML
export const generateInvoicePDF = async (invoice, settings, template) => {
  try {
    const html = await generateInvoiceHTML(invoice, settings, template);

    // Ensure invoices directory exists
    const invoicesDir = path.join(__dirname, "../../invoices");
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    const filename = `invoice-${invoice.invoiceNumber}.pdf`;
    const filepath = path.join(invoicesDir, filename);

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Generate PDF
    await page.pdf({
      path: filepath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        right: "10mm",
        bottom: "20mm",
        left: "10mm",
      },
    });

    await browser.close();

    return filepath;
  } catch (error) {
    console.error("Generate PDF error:", error);
    throw error;
  }
};

// Send invoice via email
export const sendInvoiceEmail = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { recipient, subject, message } = req.body;

    const order = await Order.findById(orderId)
      .populate("customerId", "name email")
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    let invoice = await Invoice.findOne({ orderId });
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found. Please generate invoice first.",
      });
    }

    const settings = await Settings.getSettings();
    const recipientEmail = recipient || order.customerId?.email;

    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        message: "Recipient email is required",
      });
    }

    // Generate PDF if not exists
    if (!invoice.pdfGenerated || !fs.existsSync(invoice.pdfPath)) {
      const pdfPath = await generateInvoicePDF(
        invoice,
        settings,
        invoice.template
      );
      invoice.pdfPath = pdfPath;
      invoice.pdfGenerated = true;
      await invoice.save();
    }

    await emailInvoice(invoice, recipientEmail, settings, invoice.pdfPath);

    invoice.markEmailSent(recipientEmail);
    await invoice.save();

    res.json({
      success: true,
      message: "Invoice sent successfully",
      data: {
        recipient: recipientEmail,
        sentAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Send invoice email error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send invoice email",
      error: error.message,
    });
  }
};

// Get invoice details
export const getInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findById(invoiceId)
      .populate("orderId", "orderNumber status")
      .populate("customerId", "name email phone")
      .lean();

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    res.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    console.error("Get invoice error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch invoice",
      error: error.message,
    });
  }
};

// List all invoices
export const getAllInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = "-createdAt",
      q = "",
      status,
      paymentStatus,
      dateFrom,
      dateTo,
    } = req.query;

    const searchQuery = { isDeleted: { $ne: true } };

    // Search
    if (q) {
      const searchRegex = new RegExp(q, "i");
      searchQuery.$or = [
        { invoiceNumber: searchRegex },
        { orderNumber: searchRegex },
        { "billingAddress.name": searchRegex },
        { "billingAddress.email": searchRegex },
      ];
    }

    // Filters
    if (status) searchQuery.status = status;
    if (paymentStatus) searchQuery.paymentStatus = paymentStatus;

    if (dateFrom || dateTo) {
      searchQuery.invoiceDate = {};
      if (dateFrom) searchQuery.invoiceDate.$gte = new Date(dateFrom);
      if (dateTo) searchQuery.invoiceDate.$lte = new Date(dateTo);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [invoices, total] = await Promise.all([
      Invoice.find(searchQuery)
        .populate("orderId", "orderNumber status")
        .populate("customerId", "name email")
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Invoice.countDocuments(searchQuery),
    ]);

    res.json({
      success: true,
      data: {
        invoices,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get invoices error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch invoices",
      error: error.message,
    });
  }
};
