// ==========================================
// GROWBLE QUOTATION GENERATOR
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

const copyQuotationBtn =
  document.getElementById("copyQuotationBtn");

const convertBtn =
  document.getElementById("convertBtn");

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
// MONEY FORMAT
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

function getToday() {

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
// ADD DAYS
// ------------------------------------------

function addDays(dateString, days) {

  const date =
    new Date(
      dateString + "T00:00:00"
    );

  date.setDate(
    date.getDate() + days
  );

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
// RANDOM QUOTATION NUMBER
// ------------------------------------------

function createQuotationNumber() {

  const random =
    Math.floor(
      1000 +
      Math.random() * 9000
    );

  return `QT-${random}`;

}


// ------------------------------------------
// FORMAT DATE
// ------------------------------------------

function formatDate(dateString) {

  if (!dateString) {

    return "-";

  }

  return new Date(
    dateString + "T00:00:00"
  ).toLocaleDateString(
    "en-IN"
  );

}


// ------------------------------------------
// CREATE ITEM ROW
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

      <option value="0">
        0%
      </option>

      <option value="5">
        5%
      </option>

      <option value="12">
        12%
      </option>

      <option value="18" selected>
        18%
      </option>

      <option value="28">
        28%
      </option>

    </select>

    <input
      class="item-hsn"
      type="text"
      placeholder="HSN/SAC"
    >

    <button
      type="button"
      class="remove-item"
      title="Remove item"
    >
      ×
    </button>

  `;


  itemsContainer.appendChild(row);


  row
    .querySelectorAll(
      "input, select"
    )
    .forEach(element => {

      element.addEventListener(
        "input",
        generateQuotation
      );

      element.addEventListener(
        "change",
        generateQuotation
      );

    });


  row
    .querySelector(
      ".remove-item"
    )
    .addEventListener(
      "click",
      function() {

        row.remove();

        generateQuotation();

      }
    );

}


// ------------------------------------------
// GET ITEMS
// ------------------------------------------

function getItems() {

  const rows =
    document.querySelectorAll(
      ".item-row"
    );


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

  const discount =
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
      subtotal * discount / 100
    );

  }


  return Math.min(
    subtotal,
    discount
  );

}


// ------------------------------------------
// CALCULATE
// ------------------------------------------

function calculateQuotation() {

  const items =
    getItems();


  let subtotal = 0;

  let originalGST = 0;


  items.forEach(item => {

    subtotal += item.base;

    originalGST += item.gst;

  });


  const discount =
    calculateDiscount(
      subtotal
    );


  const taxableAmount =
    Math.max(
      0,
      subtotal - discount
    );


  let finalGST = 0;


  if (subtotal > 0) {

    finalGST =
      originalGST *
      (
        taxableAmount /
        subtotal
      );

  }


  let cgst = 0;

  let sgst = 0;

  let igst = 0;


  if (
    transactionType === "intra"
  ) {

    cgst =
      finalGST / 2;

    sgst =
      finalGST / 2;

  }

  else {

    igst =
      finalGST;

  }


  const total =
    taxableAmount + finalGST;


  return {

    items,

    subtotal,

    discount,

    taxableAmount,

    finalGST,

    cgst,

    sgst,

    igst,

    total

  };

}


// ------------------------------------------
// GENERATE QUOTATION
// ------------------------------------------

function generateQuotation() {

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


  const quotationNumber =
    document.getElementById(
      "quotationNumber"
    ).value.trim();


  const quotationDate =
    document.getElementById(
      "quotationDate"
    ).value;


  const validUntil =
    document.getElementById(
      "validUntil"
    ).value;


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


  const paymentDetails =
    document.getElementById(
      "paymentDetails"
    ).value.trim();


  const notes =
    document.getElementById(
      "notes"
    ).value.trim();


  const result =
    calculateQuotation();


  // ----------------------------------------
  // BUSINESS PREVIEW
  // ----------------------------------------

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


  // ----------------------------------------
  // QUOTATION META
  // ----------------------------------------

  document.getElementById(
    "previewQuotationNumber"
  ).textContent =
    quotationNumber ||
    "QT-001";


  document.getElementById(
    "previewQuotationDate"
  ).textContent =
    formatDate(
      quotationDate
    );


  document.getElementById(
    "previewValidUntil"
  ).textContent =
    formatDate(
      validUntil
    );


  document.getElementById(
    "previewValidityBottom"
  ).textContent =
    formatDate(
      validUntil
    );


  // ----------------------------------------
  // CUSTOMER
  // ----------------------------------------

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


  // ----------------------------------------
  // ITEMS
  // ----------------------------------------

  const previewItems =
    document.getElementById(
      "previewItems"
    );


  previewItems.innerHTML = "";


  if (
    result.items.length === 0
  ) {

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

    result.items.forEach(
      item => {

        const tr =
          document.createElement(
            "tr"
          );


        const description =
          item.name ||
          "Item";


        const hsn =
          item.hsn
            ? `
              <span class="hsn">
                HSN/SAC:
                ${escapeHTML(item.hsn)}
              </span>
            `
            : "";


        tr.innerHTML = `

          <td class="item-description">

            ${escapeHTML(
              description
            )}

            ${hsn}

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
            ${money(
              item.base +
              item.gst
            )}
          </td>

        `;


        previewItems.appendChild(
          tr
        );

      }
    );

  }


  // ----------------------------------------
  // TAX SUMMARY
  // ----------------------------------------

  taxSummaryRows.innerHTML = "";


  const groups = {};


  result.items.forEach(
    item => {

      if (
        !groups[item.gstRate]
      ) {

        groups[item.gstRate] = {

          taxable: 0,

          gst: 0

        };

      }


      groups[item.gstRate]
        .taxable +=
        item.base;


      groups[item.gstRate]
        .gst +=
        item.gst;

    }
  );


  Object.keys(groups)

    .sort(
      (a, b) =>
        Number(a) -
        Number(b)
    )

    .forEach(
      rate => {

        const group =
          groups[rate];


        const ratio =
          result.subtotal > 0
            ? result.taxableAmount /
              result.subtotal
            : 0;


        const taxable =
          group.taxable *
          ratio;


        const gst =
          group.gst *
          ratio;


        const row =
          document.createElement(
            "div"
          );


        row.className =
          "tax-summary-row";


        row.innerHTML = `

          <span>
            ${money(taxable)}
          </span>

          <span>
            ${rate}%
          </span>

          <strong>
            ${money(gst)}
          </strong>

        `;


        taxSummaryRows.appendChild(
          row
        );

      }
    );


  // ----------------------------------------
  // TAX
  // ----------------------------------------

  previewCGST.textContent =
    money(result.cgst);


  previewSGST.textContent =
    money(result.sgst);


  previewIGST.textContent =
    money(result.igst);


  if (
    transactionType === "intra"
  ) {

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


  // ----------------------------------------
  // TOTALS
  // ----------------------------------------

  document.getElementById(
    "previewSubtotal"
  ).textContent =
    money(
      result.subtotal
    );


  document.getElementById(
    "previewDiscount"
  ).textContent =
    result.discount > 0
      ? "-" +
        money(result.discount)
      : money(0);


  document.getElementById(
    "previewTotal"
  ).textContent =
    money(
      result.total
    );


  // ----------------------------------------
  // PAYMENT
  // ----------------------------------------

  document.getElementById(
    "previewPaymentDetails"
  ).textContent =
    paymentDetails ||
    "-";


  // ----------------------------------------
  // TERMS
  // ----------------------------------------

  document.getElementById(
    "previewNotes"
  ).textContent =
    notes ||
    "-";

}


// ------------------------------------------
// TRANSACTION TYPE
// ------------------------------------------

function setTransactionType(type) {

  transactionType = type;


  if (
    type === "intra"
  ) {

    intraBtn.classList.add(
      "active"
    );

    interBtn.classList.remove(
      "active"
    );

  }

  else {

    intraBtn.classList.remove(
      "active"
    );

    interBtn.classList.add(
      "active"
    );

  }


  generateQuotation();

}


// ------------------------------------------
// ADD ITEM
// ------------------------------------------

addItemBtn.addEventListener(
  "click",
  function() {

    createItem();

    generateQuotation();

  }
);


// ------------------------------------------
// TRANSACTION BUTTONS
// ------------------------------------------

intraBtn.addEventListener(
  "click",
  function() {

    setTransactionType(
      "intra"
    );

  }
);


interBtn.addEventListener(
  "click",
  function() {

    setTransactionType(
      "inter"
    );

  }
);


// ------------------------------------------
// FORM INPUT LISTENERS
// ------------------------------------------

document
  .querySelectorAll(
    ".form-card input, .form-card textarea, .form-card select"
  )
  .forEach(
    element => {

      element.addEventListener(
        "input",
        generateQuotation
      );


      element.addEventListener(
        "change",
        generateQuotation
      );

    }
  );


// ------------------------------------------
// LOGO
// ------------------------------------------

logoInput.addEventListener(
  "change",
  function(event) {

    const file =
      event.target.files[0];


    if (!file) {

      return;

    }


    if (
      !file.type.startsWith(
        "image/"
      )
    ) {

      alert(
        "Please select an image file."
      );

      return;

    }


    const reader =
      new FileReader();


    reader.onload =
      function(event) {

        logoData =
          event.target.result;


        logoPreviewSmall.src =
          logoData;


        logoPreviewSmall.style.display =
          "block";


        previewLogo.src =
          logoData;


        previewLogo.style.display =
          "block";

      };


    reader.readAsDataURL(
      file
    );

  }
);


// ------------------------------------------
// GENERATE BUTTON
// ------------------------------------------

generateBtn.addEventListener(
  "click",
  function() {

    generateQuotation();


    document
      .querySelector(
        ".preview-card"
      )
      .scrollIntoView({

        behavior: "smooth",

        block: "start"

      });

  }
);


// ------------------------------------------
// PRINT
// ------------------------------------------

printBtn.addEventListener(
  "click",
  function() {

    generateQuotation();

    window.print();

  }
);


// ------------------------------------------
// COPY QUOTATION
// ------------------------------------------

copyQuotationBtn.addEventListener(
  "click",
  async function() {

    generateQuotation();


    const business =
      document.getElementById(
        "previewBusinessName"
      ).textContent;


    const quotationNo =
      document.getElementById(
        "previewQuotationNumber"
      ).textContent;


    const date =
      document.getElementById(
        "previewQuotationDate"
      ).textContent;


    const validUntil =
      document.getElementById(
        "previewValidUntil"
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

        ? `CGST: ${
            previewCGST.textContent
          }
SGST: ${
            previewSGST.textContent
          }`

        : `IGST: ${
            previewIGST.textContent
          }`;


    const total =
      document.getElementById(
        "previewTotal"
      ).textContent;


    const text = `

${business}

QUOTATION

Quotation No: ${quotationNo}
Date: ${date}
Valid Until: ${validUntil}

Prepared For:
${customer}

Subtotal: ${subtotal}
Discount: ${discount}

${gst}

Estimated Total: ${total}

Thank you for considering our services.

Generated with Growble

`.trim();


    try {

      await navigator.clipboard
        .writeText(text);


      const original =
        copyQuotationBtn.textContent;


      copyQuotationBtn.textContent =
        "Copied ✓";


      setTimeout(
        function() {

          copyQuotationBtn.textContent =
            original;

        },
        1500
      );

    }

    catch(error) {

      alert(
        "Unable to copy quotation."
      );

    }

  }
);


// ------------------------------------------
// CONVERT TO INVOICE
// ------------------------------------------

convertBtn.addEventListener(
  "click",
  function() {

    const data = {

      businessName:
        document.getElementById(
          "businessName"
        ).value,

      businessAddress:
        document.getElementById(
          "businessAddress"
        ).value,

      businessGSTIN:
        document.getElementById(
          "businessGSTIN"
        ).value,

      businessPhone:
        document.getElementById(
          "businessPhone"
        ).value,

      businessEmail:
        document.getElementById(
          "businessEmail"
        ).value,

      customerName:
        document.getElementById(
          "customerName"
        ).value,

      customerAddress:
        document.getElementById(
          "customerAddress"
        ).value,

      customerGSTIN:
        document.getElementById(
          "customerGSTIN"
        ).value,

      customerPhone:
        document.getElementById(
          "customerPhone"
        ).value,

      items:
        getItems(),

      discount:
        document.getElementById(
          "discount"
        ).value,

      discountType:
        document.getElementById(
          "discountType"
        ).value,

      transactionType,

      paymentDetails:
        document.getElementById(
          "paymentDetails"
        ).value,

      notes:
        document.getElementById(
          "notes"
        ).value

    };


    localStorage.setItem(
      "growbleQuotationData",
      JSON.stringify(data)
    );


    /*
      If your invoice generator has a different
      URL, change this path here.
    */

    window.location.href =
      "/tools/invoice-generator.html";

  }
);


// ------------------------------------------
// DEFAULT DATES
// ------------------------------------------

const today =
  getToday();


document.getElementById(
  "quotationDate"
).value =
  today;


document.getElementById(
  "validUntil"
).value =
  addDays(
    today,
    15
  );


// ------------------------------------------
// DEFAULT QUOTATION NUMBER
// ------------------------------------------

document.getElementById(
  "quotationNumber"
).value =
  createQuotationNumber();


// ------------------------------------------
// FIRST ITEM
// ------------------------------------------

createItem();


// ------------------------------------------
// INITIAL PREVIEW
// ------------------------------------------

generateQuotation();