// ==========================================
// GROWBLE GST INVOICE GENERATOR V2
// ==========================================


// ------------------------------------------
// ELEMENTS
// ------------------------------------------

const itemsContainer =
  document.getElementById("items");

const addItemBtn =
  document.getElementById("addItem");

const generateBtn =
  document.getElementById("generateBtn");

const printBtn =
  document.getElementById("printBtn");

const copyInvoiceBtn =
  document.getElementById("copyInvoiceBtn");

const logoInput =
  document.getElementById("logoInput");

const logoPreviewSmall =
  document.getElementById("logoPreviewSmall");

const previewLogo =
  document.getElementById("previewLogo");

const intraBtn =
  document.getElementById("intraBtn");

const interBtn =
  document.getElementById("interBtn");

const igstRow =
  document.getElementById("igstRow");

const previewCGST =
  document.getElementById("previewCGST");

const previewSGST =
  document.getElementById("previewSGST");

const previewIGST =
  document.getElementById("previewIGST");

const taxSummaryRows =
  document.getElementById("taxSummaryRows");


// ------------------------------------------
// STATE
// ------------------------------------------

let transactionType = "intra";

let logoData = "";


// ------------------------------------------
// CURRENCY
// ------------------------------------------

function money(value) {

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value) || 0);

}


// ------------------------------------------
// ESCAPE HTML
// ------------------------------------------

function escapeHTML(value) {

  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


// ------------------------------------------
// TODAY
// ------------------------------------------

function today() {

  const date = new Date();

  const year =
    date.getFullYear();

  const month =
    String(date.getMonth() + 1)
      .padStart(2, "0");

  const day =
    String(date.getDate())
      .padStart(2, "0");

  return `${year}-${month}-${day}`;

}


// ------------------------------------------
// INVOICE NUMBER
// ------------------------------------------

function invoiceNumber() {

  const random =
    Math.floor(
      1000 +
      Math.random() * 9000
    );

  return `INV-${random}`;

}


// ------------------------------------------
// CREATE ITEM
// ------------------------------------------

function createItem() {

  const row =
    document.createElement("div");

  row.className =
    "item-row";


  row.innerHTML = `

    <input
      class="item-name"
      type="text"
      placeholder="Product / Service"
    >

    <input
      class="item-qty"
      type="number"
      min="0"
      step="0.01"
      value="1"
    >

    <input
      class="item-rate"
      type="number"
      min="0"
      step="0.01"
      value="0"
    >

    <select class="item-gst">

      <option value="0">0%</option>
      <option value="5">5%</option>
      <option value="12">12%</option>
      <option value="18" selected>18%</option>
      <option value="28">28%</option>

    </select>

    <input
      class="item-hsn"
      type="text"
      placeholder="HSN/SAC"
    >

    <button
      class="remove-item"
      type="button"
      title="Remove item"
    >
      ×
    </button>

  `;


  itemsContainer.appendChild(row);


  row
    .querySelectorAll("input, select")
    .forEach(element => {

      element.addEventListener(
        "input",
        generateInvoice
      );

      element.addEventListener(
        "change",
        generateInvoice
      );

    });


  row
    .querySelector(".remove-item")
    .addEventListener(
      "click",
      function() {

        row.remove();

        generateInvoice();

      }
    );

}


// ------------------------------------------
// GET ITEMS
// ------------------------------------------

function getItems() {

  const rows =
    document.querySelectorAll(".item-row");

  const items = [];


  rows.forEach(row => {

    const name =
      row.querySelector(
        ".item-name"
      ).value.trim();


    const quantity =
      Number(
        row.querySelector(
          ".item-qty"
        ).value
      ) || 0;


    const rate =
      Number(
        row.querySelector(
          ".item-rate"
        ).value
      ) || 0;


    const gstRate =
      Number(
        row.querySelector(
          ".item-gst"
        ).value
      ) || 0;


    const hsn =
      row.querySelector(
        ".item-hsn"
      ).value.trim();


    const base =
      quantity * rate;


    const gst =
      base * gstRate / 100;


    items.push({

      name,
      quantity,
      rate,
      gstRate,
      hsn,
      base,
      gst

    });

  });


  return items;

}


// ------------------------------------------
// DISCOUNT
// ------------------------------------------

function calculateDiscount(
  subtotal
) {

  const discountValue =
    Math.max(
      0,
      Number(
        document.getElementById(
          "discount"
        ).value
      ) || 0
    );


  const type =
    document.getElementById(
      "discountType"
    ).value;


  if (type === "percent") {

    return Math.min(
      subtotal,
      subtotal *
      discountValue /
      100
    );

  }


  return Math.min(
    subtotal,
    discountValue
  );

}


// ------------------------------------------
// GENERATE
// ------------------------------------------

function generateInvoice() {

  // ----------------------------------------
  // BUSINESS
  // ----------------------------------------

  const businessName =
    document.getElementById(
      "businessName"
    ).value.trim();


  const businessAddress =
    document.getElementById(
      "businessAddress"
    ).value.trim();


  const businessGSTIN =
    document.getElementById(
      "businessGSTIN"
    ).value.trim();


  const businessPhone =
    document.getElementById(
      "businessPhone"
    ).value.trim();


  const businessEmail =
    document.getElementById(
      "businessEmail"
    ).value.trim();


  // ----------------------------------------
  // INVOICE
  // ----------------------------------------

  const invoiceNo =
    document.getElementById(
      "invoiceNumber"
    ).value.trim();


  const invoiceDate =
    document.getElementById(
      "invoiceDate"
    ).value;


  const placeOfSupply =
    document.getElementById(
      "placeOfSupply"
    ).value.trim();


  // ----------------------------------------
  // CUSTOMER
  // ----------------------------------------

  const customerName =
    document.getElementById(
      "customerName"
    ).value.trim();


  const customerAddress =
    document.getElementById(
      "customerAddress"
    ).value.trim();


  const customerGSTIN =
    document.getElementById(
      "customerGSTIN"
    ).value.trim();


  const customerPhone =
    document.getElementById(
      "customerPhone"
    ).value.trim();


  // ----------------------------------------
  // PAYMENT
  // ----------------------------------------

  const paymentDetails =
    document.getElementById(
      "paymentDetails"
    ).value.trim();


  const notes =
    document.getElementById(
      "notes"
    ).value.trim();


  // ----------------------------------------
  // ITEMS
  // ----------------------------------------

  const items =
    getItems();


  // ----------------------------------------
  // SUBTOTAL
  // ----------------------------------------

  let subtotal = 0;

  let originalGST = 0;


  items.forEach(item => {

    subtotal += item.base;

    originalGST += item.gst;

  });


  // ----------------------------------------
  // DISCOUNT
  // ----------------------------------------

  const discount =
    calculateDiscount(
      subtotal
    );


  const taxableAmount =
    Math.max(
      0,
      subtotal - discount
    );


  // ----------------------------------------
  // GST AFTER DISCOUNT
  // ----------------------------------------

  let finalGST = 0;


  if (subtotal > 0) {

    finalGST =
      originalGST *
      (
        taxableAmount /
        subtotal
      );

  }


  // ----------------------------------------
  // CGST / SGST / IGST
  // ----------------------------------------

  let cgst = 0;

  let sgst = 0;

  let igst = 0;


  if (transactionType === "intra") {

    cgst =
      finalGST / 2;

    sgst =
      finalGST / 2;

  }

  else {

    igst =
      finalGST;

  }


  // ----------------------------------------
  // GRAND TOTAL
  // ----------------------------------------

  const total =
    taxableAmount +
    finalGST;


  // ========================================
  // UPDATE BUSINESS
  // ========================================

  document.getElementById(
    "previewBusinessName"
  ).textContent =
    businessName ||
    "Your Business";


  document.getElementById(
    "previewBusinessAddress"
  ).textContent =
    businessAddress ||
    "Business address";


  document.getElementById(
    "previewBusinessGSTIN"
  ).textContent =
    businessGSTIN ||
    "-";


  let contact = "";


  if (businessPhone) {

    contact +=
      businessPhone;

  }


  if (
    businessPhone &&
    businessEmail
  ) {

    contact += " • ";

  }


  if (businessEmail) {

    contact +=
      businessEmail;

  }


  document.getElementById(
    "previewBusinessContact"
  ).textContent =
    contact ||
    "Phone / Email";


  // ========================================
  // INVOICE META
  // ========================================

  document.getElementById(
    "previewInvoiceNumber"
  ).textContent =
    invoiceNo ||
    "INV-001";


  document.getElementById(
    "previewInvoiceDate"
  ).textContent =
    invoiceDate
      ? new Date(
          invoiceDate + "T00:00:00"
        ).toLocaleDateString(
          "en-IN"
        )
      : "-";


  document.getElementById(
    "previewPlaceOfSupply"
  ).textContent =
    placeOfSupply ||
    "-";


  // ========================================
  // CUSTOMER
  // ========================================

  document.getElementById(
    "previewCustomerName"
  ).textContent =
    customerName ||
    "Customer Name";


  document.getElementById(
    "previewCustomerAddress"
  ).textContent =
    customerAddress ||
    "Customer address";


  document.getElementById(
    "previewCustomerGSTIN"
  ).textContent =
    customerGSTIN ||
    "-";


  document.getElementById(
    "previewCustomerPhone"
  ).textContent =
    customerPhone ||
    "-";


  // ========================================
  // ITEMS PREVIEW
  // ========================================

  const previewItems =
    document.getElementById(
      "previewItems"
    );


  previewItems.innerHTML = "";


  if (items.length === 0) {

    previewItems.innerHTML = `

      <tr>

        <td>
          Item
        </td>

        <td>
          1
        </td>

        <td>
          ₹0.00
        </td>

        <td>
          0%
        </td>

        <td>
          ₹0.00
        </td>

      </tr>

    `;

  }

  else {

    items.forEach(item => {

      const tr =
        document.createElement("tr");


      const description =
        item.name ||
        "Item";


      const hsnText =
        item.hsn
          ? `<span class="hsn">
               HSN/SAC: ${escapeHTML(item.hsn)}
             </span>`
          : "";


      tr.innerHTML = `

        <td class="item-description">

          ${escapeHTML(description)}

          ${hsnText}

        </td>

        <td>
          ${item.quantity}
        </td>

        <td>
          ${money(item.rate)}
        </td>

        <td>
          ${item.gstRate}%
        </td>

        <td>
          ${money(item.base + item.gst)}
        </td>

      `;


      previewItems.appendChild(tr);

    });

  }


  // ========================================
  // TAX SUMMARY
  // ========================================

  taxSummaryRows.innerHTML = "";


  const taxGroups = {};


  items.forEach(item => {

    if (!taxGroups[item.gstRate]) {

      taxGroups[item.gstRate] = {

        taxable: 0,
        gst: 0

      };

    }


    taxGroups[item.gstRate].taxable +=
      item.base;

    taxGroups[item.gstRate].gst +=
      item.gst;

  });


  Object.keys(taxGroups)
    .sort(
      (a,b) =>
        Number(a) - Number(b)
    )
    .forEach(rate => {

      const group =
        taxGroups[rate];


      const ratio =
        subtotal > 0
          ? taxableAmount / subtotal
          : 0;


      const groupTaxable =
        group.taxable * ratio;


      const groupGST =
        group.gst * ratio;


      const row =
        document.createElement("div");


      row.className =
        "tax-summary-row";


      row.innerHTML = `

        <span>
          ${money(groupTaxable)}
        </span>

        <span>
          ${rate}%
        </span>

        <strong>
          ${money(groupGST)}
        </strong>

      `;


      taxSummaryRows.appendChild(row);

    });


  // ========================================
  // TAX TOTALS
  // ========================================

  previewCGST.textContent =
    money(cgst);


  previewSGST.textContent =
    money(sgst);


  previewIGST.textContent =
    money(igst);


  if (transactionType === "intra") {

    previewCGST.parentElement
      .style.display = "flex";

    previewSGST.parentElement
      .style.display = "flex";

    igstRow.style.display =
      "none";

  }

  else {

    previewCGST.parentElement
      .style.display = "none";

    previewSGST.parentElement
      .style.display = "none";

    igstRow.style.display =
      "flex";

  }


  // ========================================
  // TOTALS
  // ========================================

  document.getElementById(
    "previewSubtotal"
  ).textContent =
    money(subtotal);


  document.getElementById(
    "previewDiscount"
  ).textContent =
    discount > 0
      ? "-" + money(discount)
      : money(0);


  document.getElementById(
    "previewTotal"
  ).textContent =
    money(total);


  // ========================================
  // PAYMENT
  // ========================================

  document.getElementById(
    "previewPaymentDetails"
  ).textContent =
    paymentDetails ||
    "-";


  // ========================================
  // NOTES
  // ========================================

  document.getElementById(
    "previewNotes"
  ).textContent =
    notes ||
    "Thank you for your business.";

}


// ==========================================
// TRANSACTION TYPE
// ==========================================

function setTransactionType(type) {

  transactionType = type;


  if (type === "intra") {

    intraBtn.classList.add("active");

    interBtn.classList.remove("active");

  }

  else {

    intraBtn.classList.remove("active");

    interBtn.classList.add("active");

  }


  generateInvoice();

}


// ==========================================
// ADD ITEM
// ==========================================

addItemBtn.addEventListener(
  "click",
  function() {

    createItem();

    generateInvoice();

  }
);


// ==========================================
// TRANSACTION BUTTONS
// ==========================================

intraBtn.addEventListener(
  "click",
  function() {

    setTransactionType("intra");

  }
);


interBtn.addEventListener(
  "click",
  function() {

    setTransactionType("inter");

  }
);


// ==========================================
// FORM INPUTS
// ==========================================

document
  .querySelectorAll(
    ".form-card input, .form-card textarea, .form-card select"
  )
  .forEach(element => {

    element.addEventListener(
      "input",
      generateInvoice
    );

    element.addEventListener(
      "change",
      generateInvoice
    );

  });


// ==========================================
// LOGO UPLOAD
// ==========================================

logoInput.addEventListener(
  "change",
  function(event) {

    const file =
      event.target.files[0];


    if (!file) {

      return;

    }


    if (!file.type.startsWith("image/")) {

      alert(
        "Please select an image file."
      );

      return;

    }


    const reader =
      new FileReader();


    reader.onload =
      function(e) {

        logoData =
          e.target.result;


        logoPreviewSmall.src =
          logoData;

        logoPreviewSmall.style.display =
          "block";


        previewLogo.src =
          logoData;

        previewLogo.style.display =
          "block";

      };


    reader.readAsDataURL(file);

  }
);


// ==========================================
// GENERATE BUTTON
// ==========================================

generateBtn.addEventListener(
  "click",
  function() {

    generateInvoice();


    document
      .querySelector(".preview-card")
      .scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

  }
);


// ==========================================
// PRINT / SAVE PDF
// ==========================================

printBtn.addEventListener(
  "click",
  function() {

    generateInvoice();

    window.print();

  }
);


// ==========================================
// COPY INVOICE
// ==========================================

copyInvoiceBtn.addEventListener(
  "click",
  async function() {

    generateInvoice();


    const business =
      document.getElementById(
        "previewBusinessName"
      ).textContent;


    const invoiceNo =
      document.getElementById(
        "previewInvoiceNumber"
      ).textContent;


    const date =
      document.getElementById(
        "previewInvoiceDate"
      ).textContent;


    const customer =
      document.getElementById(
        "previewCustomerName"
      ).textContent;


    const subtotal =
      document.getElementById(
        "previewSubtotal"
      ).textContent;


    const discount =
      document.getElementById(
        "previewDiscount"
      ).textContent;


    const gst =
      transactionType === "intra"
        ? (
            `CGST: ${
              previewCGST.textContent
            }\n` +
            `SGST: ${
              previewSGST.textContent
            }`
          )
        : (
            `IGST: ${
              previewIGST.textContent
            }`
          );


    const total =
      document.getElementById(
        "previewTotal"
      ).textContent;


    const text = `

${business}

INVOICE

Invoice No: ${invoiceNo}
Date: ${date}

Bill To:
${customer}

Subtotal: ${subtotal}
Discount: ${discount}

${gst}

Total: ${total}

Thank you for your business.

Generated with Growble
`.trim();


    try {

      await navigator.clipboard.writeText(
        text
      );


      const original =
        copyInvoiceBtn.textContent;


      copyInvoiceBtn.textContent =
        "Copied ✓";


      setTimeout(
        function() {

          copyInvoiceBtn.textContent =
            original;

        },
        1500
      );

    }

    catch(error) {

      alert(
        "Unable to copy invoice."
      );

    }

  }
);


// ==========================================
// DEFAULT VALUES
// ==========================================

document.getElementById(
  "invoiceNumber"
).value =
  invoiceNumber();


document.getElementById(
  "invoiceDate"
).value =
  today();


// ==========================================
// FIRST ITEM
// ==========================================

createItem();


// ==========================================
// INITIAL PREVIEW
// ==========================================

generateInvoice();